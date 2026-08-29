// ============================================
// Event Routes
// ============================================
const { Router } = require('express');
const { createEvent, getEvents, getEventById, replayEvent, exportEvents, getEventTypes } = require('../controllers/event.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { idempotencyMiddleware } = require('../middleware/idempotency.middleware');
const { rateLimitMiddleware } = require('../middleware/rateLimit.middleware');

const router = Router();

/**
 * @swagger
 * /api/v1/events:
 *   post:
 *     tags: [Events]
 *     summary: Ingest a new event
 *     description: Submit an event with an Idempotency-Key header. Duplicates are automatically detected and return cached response.
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Unique UUID to ensure idempotent processing
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, payload]
 *             properties:
 *               type: { type: string, enum: [payment.success, payment.failed, order.placed, order.cancelled, user.signup, notification.send, webhook.received] }
 *               payload: { type: object }
 *               metadata: { type: object }
 *               priority: { type: string, enum: [low, medium, high, critical], default: medium }
 *     responses:
 *       201: { description: Event created and enqueued }
 *       200: { description: Duplicate detected, cached response returned }
 *       400: { description: Validation error }
 *       429: { description: Rate limit exceeded }
 */
router.post('/', authMiddleware, rateLimitMiddleware(), idempotencyMiddleware, createEvent);

/**
 * @swagger
 * /api/v1/events:
 *   get:
 *     tags: [Events]
 *     summary: List events with filtering and pagination
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, processed, failed, dead] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, critical] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25, maximum: 100 }
 *     responses:
 *       200: { description: Paginated event list }
 */
router.get('/', authMiddleware, getEvents);

/**
 * @swagger
 * /api/v1/events/types:
 *   get:
 *     tags: [Events]
 *     summary: Get all supported event types
 *     responses:
 *       200: { description: List of event types }
 */
router.get('/types', authMiddleware, getEventTypes);

/**
 * @swagger
 * /api/v1/events/export:
 *   get:
 *     tags: [Events]
 *     summary: Export events as CSV
 *     responses:
 *       200: { description: CSV file download }
 */
router.get('/export', authMiddleware, exportEvents);

/**
 * @swagger
 * /api/v1/events/{id}:
 *   get:
 *     tags: [Events]
 *     summary: Get event details with retry history
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Event details }
 *       404: { description: Event not found }
 */
router.get('/:id', authMiddleware, getEventById);

/**
 * @swagger
 * /api/v1/events/{id}/replay:
 *   post:
 *     tags: [Events]
 *     summary: Replay an event with a new idempotency key
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201: { description: Event replayed }
 */
router.post('/:id/replay', authMiddleware, replayEvent);

module.exports = router;
