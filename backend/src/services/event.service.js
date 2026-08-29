// ============================================
// Event Service — CRUD & Business Logic
// ============================================
const { getPrismaClient } = require('../utils/prisma');
const { getRedisClient } = require('../utils/redis');
const queueService = require('./queue.service');
const { dispatch } = require('../handlers');
const logger = require('../utils/logger');

class EventService {
  constructor() {
    this.prisma = getPrismaClient();
    this.redis = getRedisClient();
  }

  /**
   * Create a new event and enqueue it for processing.
   * CRITICAL priority events are processed synchronously.
   */
  async createEvent({ type, payload, metadata, priority, idempotencyKey }) {
    // Create event in database
    const event = await this.prisma.event.create({
      data: {
        idempotencyKey,
        type,
        payload: payload || {},
        metadata: metadata || {},
        priority: priority || 'medium',
        status: 'pending',
        retryCount: 0,
        maxRetries: 5,
      },
    });

    logger.info('Event created', { eventId: event.id, type, priority: event.priority });

    // Track metric
    await this.redis.incr('metrics:events_received');

    // CRITICAL events: process synchronously
    if (event.priority === 'critical') {
      return this.processSynchronously(event);
    }

    // Enqueue for async processing
    await queueService.enqueue(event.id, event.priority, {
      type: event.type,
      payload: event.payload,
      metadata: event.metadata,
    });

    return event;
  }

  /**
   * Process a CRITICAL event synchronously (bypass queue).
   */
  async processSynchronously(event) {
    const startTime = Date.now();

    try {
      await this.prisma.event.update({
        where: { id: event.id },
        data: { status: 'processing', processingStartedAt: new Date() },
      });

      const result = await dispatch(event);
      const processingTimeMs = Date.now() - startTime;

      const updatedEvent = await this.prisma.event.update({
        where: { id: event.id },
        data: {
          status: 'processed',
          processedAt: new Date(),
          processingTimeMs,
        },
      });

      logger.info('Critical event processed synchronously', {
        eventId: event.id,
        processingTimeMs,
      });

      // Emit SSE event
      this.emitSSE(updatedEvent);

      return updatedEvent;
    } catch (err) {
      await this.prisma.event.update({
        where: { id: event.id },
        data: {
          status: 'failed',
          errorMessage: err.message,
          errorStack: err.stack,
        },
      });
      throw err;
    }
  }

  /**
   * Get events with filtering and pagination.
   */
  async getEvents({ status, type, priority, search, page = 1, limit = 25, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const where = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { idempotencyKey: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.event.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Get a single event by ID with retry logs.
   */
  async getEventById(id) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        retryLogs: { orderBy: { attemptNumber: 'asc' } },
        alerts: { orderBy: { createdAt: 'desc' } },
        idempotencyStore: true,
      },
    });
  }

  /**
   * Replay an event with a new idempotency key.
   */
  async replayEvent(eventId, newIdempotencyKey) {
    const original = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!original) {
      throw new Error('Event not found');
    }

    return this.createEvent({
      type: original.type,
      payload: original.payload,
      metadata: { ...original.metadata, replayedFrom: eventId },
      priority: original.priority,
      idempotencyKey: newIdempotencyKey,
    });
  }

  /**
   * Get dead letter queue events.
   */
  async getDeadEvents({ page = 1, limit = 25 }) {
    const where = { status: 'dead' };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          retryLogs: { orderBy: { attemptNumber: 'asc' } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Replay a dead letter event.
   */
  async replayDeadEvent(eventId) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'dead') {
      throw new Error('Dead event not found');
    }

    // Reset event for reprocessing
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'pending',
        retryCount: 0,
        errorMessage: null,
        errorStack: null,
        processingStartedAt: null,
        processedAt: null,
        processingTimeMs: null,
      },
    });

    // Re-enqueue
    await queueService.enqueue(updated.id, updated.priority, {
      type: updated.type,
      payload: updated.payload,
      metadata: { ...updated.metadata, replayed: true, replayedAt: new Date().toISOString() },
    });

    logger.info('Dead event replayed', { eventId });
    return updated;
  }

  /**
   * Discard a dead letter event permanently.
   */
  async discardDeadEvent(eventId) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.status !== 'dead') {
      throw new Error('Dead event not found');
    }

    await this.prisma.event.delete({ where: { id: eventId } });
    logger.info('Dead event discarded', { eventId });
    return { discarded: true };
  }

  /**
   * Get events for CSV export.
   */
  async getEventsForExport(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    return this.prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
  }

  /**
   * Emit SSE event (called from worker and sync processing).
   */
  emitSSE(event) {
    // This will be picked up by the SSE route's event emitter
    if (global.sseEmitter) {
      global.sseEmitter.emit('event', event);
    }
  }
}

module.exports = new EventService();
