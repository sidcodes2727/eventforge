// ============================================
// Worker Service — Event Consumer & Processor
// ============================================
const { getPrismaClient } = require('../utils/prisma');
const { getRedisClient } = require('../utils/redis');
const queueService = require('./queue.service');
const lockService = require('./lock.service');
const { dispatch } = require('../handlers');
const logger = require('../utils/logger');

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '5', 10);

class WorkerService {
  constructor() {
    this.prisma = getPrismaClient();
    this.redis = getRedisClient();
    this.running = false;
    this.consumerName = `worker-${process.pid}-${Date.now()}`;
  }

  /**
   * Start consuming events from all priority streams.
   */
  async start() {
    this.running = true;
    logger.info('Worker started', { consumerName: this.consumerName });

    await queueService.initializeStreams();

    while (this.running) {
      try {
        const events = await queueService.readEvents(this.consumerName, 5, 2000);

        for (const { stream, messageId, data } of events) {
          await this.processEvent(stream, messageId, data);
        }
      } catch (err) {
        if (this.running) {
          logger.error('Worker loop error', { error: err.message });
          await this.sleep(1000);
        }
      }
    }

    logger.info('Worker stopped');
  }

  /**
   * Process a single event from the stream.
   */
  async processEvent(stream, messageId, data) {
    const { eventId } = data;
    if (!eventId) {
      logger.error('Event missing eventId, acknowledging to skip', { messageId });
      await queueService.acknowledge(stream, messageId);
      return;
    }

    // Acquire distributed lock to prevent duplicate processing
    const { acquired, lockValue } = await lockService.acquire(eventId);
    if (!acquired) {
      logger.warn('Could not acquire lock, will retry', { eventId });
      return; // Don't acknowledge — will be retried
    }

    const startTime = Date.now();

    try {
      // Fetch event from database
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });

      if (!event) {
        logger.warn('Event not found in database', { eventId });
        await queueService.acknowledge(stream, messageId);
        await lockService.release(eventId, lockValue);
        return;
      }

      // Skip if already processed or dead
      if (event.status === 'processed' || event.status === 'dead') {
        logger.info('Event already in terminal state, skipping', { eventId, status: event.status });
        await queueService.acknowledge(stream, messageId);
        await lockService.release(eventId, lockValue);
        return;
      }

      // Update status to processing
      await this.prisma.event.update({
        where: { id: eventId },
        data: { status: 'processing', processingStartedAt: new Date() },
      });

      // Dispatch to appropriate handler
      const result = await dispatch(event);
      const processingTimeMs = Date.now() - startTime;

      // Update event as processed
      const updatedEvent = await this.prisma.event.update({
        where: { id: eventId },
        data: {
          status: 'processed',
          processedAt: new Date(),
          processingTimeMs,
          errorMessage: null,
          errorStack: null,
        },
      });

      // Track metrics
      await this.redis.incr('metrics:events_processed');

      logger.info('Event processed successfully', {
        eventId,
        type: event.type,
        processingTimeMs,
      });

      // Emit SSE update
      if (global.sseEmitter) {
        global.sseEmitter.emit('event', updatedEvent);
      }

      // Acknowledge message
      await queueService.acknowledge(stream, messageId);

    } catch (err) {
      logger.error('Event processing failed', {
        eventId,
        error: err.message,
        stack: err.stack,
      });

      await this.handleFailure(eventId, stream, messageId, data, err);

    } finally {
      await lockService.release(eventId, lockValue);
    }
  }

  /**
   * Handle event processing failure with exponential backoff.
   */
  async handleFailure(eventId, stream, messageId, data, err) {
    try {
      const event = await this.prisma.event.findUnique({ where: { id: eventId } });
      if (!event) return;

      const newRetryCount = event.retryCount + 1;
      const backoffMs = Math.pow(2, newRetryCount) * 1000; // Exponential backoff
      const nextRetryAt = new Date(Date.now() + backoffMs);

      // Log the retry attempt
      await this.prisma.retryLog.create({
        data: {
          eventId,
          attemptNumber: newRetryCount,
          error: err.message,
          nextRetryAt: newRetryCount <= MAX_RETRIES ? nextRetryAt : null,
        },
      });

      if (newRetryCount >= MAX_RETRIES) {
        // Max retries reached — move to dead letter
        await this.prisma.event.update({
          where: { id: eventId },
          data: {
            status: 'dead',
            retryCount: newRetryCount,
            errorMessage: err.message,
            errorStack: err.stack,
          },
        });

        // Move to dead letter stream
        await queueService.moveToDeadLetter(eventId, data, err.message, err.stack);

        // Create alert
        await this.prisma.alert.create({
          data: {
            eventId,
            type: 'event.dead',
            message: `Event ${eventId} moved to DLQ after ${MAX_RETRIES} failures: ${err.message}`,
            severity: 'critical',
          },
        });

        await this.redis.incr('metrics:events_dead');

        logger.error('Event moved to dead letter queue', { eventId, retryCount: newRetryCount });

        // Emit SSE
        if (global.sseEmitter) {
          global.sseEmitter.emit('event', { id: eventId, status: 'dead', type: data.type });
        }
      } else {
        // Schedule retry with backoff
        await this.prisma.event.update({
          where: { id: eventId },
          data: {
            status: 'failed',
            retryCount: newRetryCount,
            errorMessage: err.message,
            errorStack: err.stack,
          },
        });

        await this.redis.incr('metrics:events_failed');

        // Re-enqueue after backoff delay
        setTimeout(async () => {
          try {
            await queueService.enqueue(eventId, data.priority || 'medium', {
              type: data.type,
              payload: data.payload,
              metadata: data.metadata,
            });
            logger.info('Event re-enqueued for retry', {
              eventId,
              retryCount: newRetryCount,
              nextRetryAt: nextRetryAt.toISOString(),
            });
          } catch (enqueueErr) {
            logger.error('Failed to re-enqueue event', { eventId, error: enqueueErr.message });
          }
        }, backoffMs);
      }

      // Acknowledge the original message regardless
      await queueService.acknowledge(stream, messageId);

    } catch (failErr) {
      logger.error('Error handling failure', { eventId, error: failErr.message });
      // Still acknowledge to prevent infinite loop
      await queueService.acknowledge(stream, messageId);
    }
  }

  /**
   * Graceful shutdown — stop consuming and drain.
   */
  async stop() {
    this.running = false;
    logger.info('Worker shutting down...');
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = WorkerService;
