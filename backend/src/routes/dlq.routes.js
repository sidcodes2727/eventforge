// ============================================
// DLQ Routes — Dead Letter Queue
// ============================================
const { Router } = require('express');
const { getDeadEvents, replayDeadEvent, bulkReplayDeadEvents, discardDeadEvent } = require('../controllers/dlq.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = Router();

/**
 * @swagger
 * /api/v1/dlq:
 *   get:
 *     tags: [Dead Letter Queue]
 *     summary: List all dead letter events
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 *     responses:
 *       200: { description: Paginated list of dead events }
 */
router.get('/', authMiddleware, getDeadEvents);

/**
 * @swagger
 * /api/v1/dlq/bulk-replay:
 *   post:
 *     tags: [Dead Letter Queue]
 *     summary: Bulk replay dead events
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Bulk replay results }
 */
router.post('/bulk-replay', authMiddleware, bulkReplayDeadEvents);

/**
 * @swagger
 * /api/v1/dlq/{id}/replay:
 *   post:
 *     tags: [Dead Letter Queue]
 *     summary: Replay a single dead event
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Event replayed }
 */
router.post('/:id/replay', authMiddleware, replayDeadEvent);

/**
 * @swagger
 * /api/v1/dlq/{id}:
 *   delete:
 *     tags: [Dead Letter Queue]
 *     summary: Discard a dead event permanently
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Event discarded }
 */
router.delete('/:id', authMiddleware, discardDeadEvent);

module.exports = router;
