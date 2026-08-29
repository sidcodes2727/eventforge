// ============================================
// Event Controller — Ingestion & Management
// ============================================
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const eventService = require('../services/event.service');
const idempotencyService = require('../services/idempotency.service');
const { success, error, paginated } = require('../utils/response');
const logger = require('../utils/logger');

// ── Zod Schemas per Event Type ───────────────────

const basePayloadSchema = z.object({}).passthrough();

const payloadSchemas = {
  'payment.success': z.object({
    amount: z.number().positive(),
    currency: z.string().default('USD'),
    transactionId: z.string().optional(),
    customerId: z.string().optional(),
  }).passthrough(),

  'payment.failed': z.object({
    amount: z.number().positive().optional(),
    reason: z.string(),
    transactionId: z.string().optional(),
  }).passthrough(),

  'order.placed': z.object({
    orderId: z.string(),
    items: z.array(z.any()).optional(),
    total: z.number().optional(),
    customerId: z.string().optional(),
  }).passthrough(),

  'order.cancelled': z.object({
    orderId: z.string(),
    reason: z.string().optional(),
  }).passthrough(),

  'user.signup': z.object({
    email: z.string().email(),
    name: z.string().optional(),
    source: z.string().optional(),
  }).passthrough(),

  'notification.send': z.object({
    channel: z.enum(['email', 'sms', 'push', 'slack']),
    recipient: z.string(),
    message: z.string(),
  }).passthrough(),

  'webhook.received': z.object({
    source: z.string(),
    webhookId: z.string().optional(),
    data: z.any().optional(),
  }).passthrough(),
};

const eventTypes = Object.keys(payloadSchemas);

const createEventSchema = z.object({
  type: z.enum(eventTypes),
  payload: z.object({}).passthrough(),
  metadata: z.object({}).passthrough().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

// ── Controllers ──────────────────────────────────

async function createEvent(req, res) {
  try {
    // Validate base schema
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Validation failed', 400, parsed.error.flatten().fieldErrors);
    }

    const { type, payload, metadata, priority } = parsed.data;

    // Validate payload per event type
    const payloadSchema = payloadSchemas[type] || basePayloadSchema;
    const payloadParsed = payloadSchema.safeParse(payload);
    if (!payloadParsed.success) {
      return error(res, `Invalid payload for event type "${type}"`, 400, payloadParsed.error.flatten().fieldErrors);
    }

    const idempotencyKey = res.locals.idempotencyKey;

    // Enrich metadata
    const enrichedMetadata = {
      ...metadata,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      apiKeyUsed: req.headers['x-api-key'] || null,
      userId: req.user?.id || null,
    };

    // Create and enqueue event
    const event = await eventService.createEvent({
      type,
      payload: payloadParsed.data,
      metadata: enrichedMetadata,
      priority,
      idempotencyKey,
    });

    // Store idempotency key with response
    const responsePayload = {
      eventId: event.id,
      type: event.type,
      status: event.status,
      priority: event.priority,
    };

    await idempotencyService.storeKey(idempotencyKey, event.id, responsePayload);

    logger.info('Event ingested', { eventId: event.id, type, priority });

    return success(res, {
      event: {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        type: event.type,
        status: event.status,
        priority: event.priority,
        createdAt: event.createdAt,
      },
    }, 201, {
      'X-Idempotency-Key': idempotencyKey,
    });

  } catch (err) {
    logger.error('Event creation failed', { error: err.message });
    return error(res, 'Failed to create event', 500);
  }
}

async function getEvents(req, res) {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);
    const { status, type, priority, search, sortBy, sortOrder } = req.query;

    const { events, total } = await eventService.getEvents({
      status, type, priority, search,
      page, limit,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    });

    return paginated(res, events, total, page, limit);

  } catch (err) {
    logger.error('Get events failed', { error: err.message });
    return error(res, 'Failed to fetch events', 500);
  }
}

async function getEventById(req, res) {
  try {
    const event = await eventService.getEventById(req.params.id);
    if (!event) {
      return error(res, 'Event not found', 404);
    }
    return success(res, { event });
  } catch (err) {
    logger.error('Get event failed', { error: err.message });
    return error(res, 'Failed to fetch event', 500);
  }
}

async function replayEvent(req, res) {
  try {
    const newIdempotencyKey = uuidv4();
    const event = await eventService.replayEvent(req.params.id, newIdempotencyKey);
    return success(res, {
      event,
      newIdempotencyKey,
      message: 'Event replayed with new idempotency key',
    }, 201);
  } catch (err) {
    logger.error('Event replay failed', { error: err.message });
    return error(res, err.message || 'Failed to replay event', 400);
  }
}

async function exportEvents(req, res) {
  try {
    const { status, type } = req.query;
    const events = await eventService.getEventsForExport({ status, type });

    // Generate CSV
    const headers = ['id', 'idempotencyKey', 'type', 'status', 'priority', 'retryCount', 'processingTimeMs', 'createdAt'];
    const csv = [
      headers.join(','),
      ...events.map(e => headers.map(h => JSON.stringify(e[h] ?? '')).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="events-${Date.now()}.csv"`);
    return res.send(csv);

  } catch (err) {
    logger.error('Event export failed', { error: err.message });
    return error(res, 'Failed to export events', 500);
  }
}

function getEventTypes(req, res) {
  return success(res, { types: eventTypes });
}

module.exports = { createEvent, getEvents, getEventById, replayEvent, exportEvents, getEventTypes };
