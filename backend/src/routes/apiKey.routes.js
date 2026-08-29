// ============================================
// API Key Routes
// ============================================
const { Router } = require('express');
const { listApiKeys, createApiKey, revokeApiKey } = require('../controllers/apiKey.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const router = Router();

/**
 * @swagger
 * /api/v1/api-keys:
 *   get:
 *     tags: [API Keys]
 *     summary: List user's API keys
 *     responses:
 *       200: { description: List of API keys (masked) }
 */
router.get('/', authMiddleware, listApiKeys);

/**
 * @swagger
 * /api/v1/api-keys:
 *   post:
 *     tags: [API Keys]
 *     summary: Create a new API key
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               rateLimit: { type: integer, default: 100 }
 *               expiresInDays: { type: integer }
 *     responses:
 *       201: { description: API key created (key shown only once) }
 */
router.post('/', authMiddleware, createApiKey);

/**
 * @swagger
 * /api/v1/api-keys/{id}/revoke:
 *   post:
 *     tags: [API Keys]
 *     summary: Revoke an API key
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: API key revoked }
 */
router.post('/:id/revoke', authMiddleware, revokeApiKey);

module.exports = router;
