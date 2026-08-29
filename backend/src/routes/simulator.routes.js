// ============================================
// Simulator Routes
// ============================================
const { Router } = require('express');
const { simulateWebhook } = require('../controllers/simulator.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = Router();

/**
 * @swagger
 * /api/v1/simulate/webhook:
 *   post:
 *     tags: [Simulator]
 *     summary: Simulate duplicate webhook events
 *     description: Sends the same idempotency key N times to demonstrate deduplication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventType: { type: string, default: webhook.received }
 *               payload: { type: object }
 *               duplicateCount: { type: integer, minimum: 1, maximum: 10, default: 3 }
 *               delayBetweenMs: { type: integer, default: 100 }
 *               priority: { type: string, enum: [low, medium, high, critical], default: medium }
 *     responses:
 *       200:
 *         description: Simulation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sent: { type: integer }
 *                 processed: { type: integer }
 *                 duplicatesBlocked: { type: integer }
 *                 results: { type: array }
 */
router.post('/webhook', authMiddleware, simulateWebhook);

module.exports = router;
