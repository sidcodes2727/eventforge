// ============================================
// Metrics Routes
// ============================================
const { Router } = require('express');
const metricsService = require('../services/metrics.service');
const { success, error } = require('../utils/response');
const { authMiddleware } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = Router();

/**
 * @swagger
 * /api/v1/metrics:
 *   get:
 *     tags: [Metrics]
 *     summary: Get system metrics and health data
 *     responses:
 *       200:
 *         description: System metrics
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const metrics = await metricsService.getMetrics();
    return success(res, metrics);
  } catch (err) {
    logger.error('Metrics fetch failed', { error: err.message });
    return error(res, 'Failed to fetch metrics', 500);
  }
});

/**
 * @swagger
 * /api/v1/metrics/timeline:
 *   get:
 *     tags: [Metrics]
 *     summary: Get events over time data for charts
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema: { type: integer, default: 24 }
 *     responses:
 *       200: { description: Timeline data }
 */
router.get('/timeline', authMiddleware, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours || '24', 10);
    const data = await metricsService.getEventsOverTime(hours);
    return success(res, { timeline: data });
  } catch (err) {
    logger.error('Timeline fetch failed', { error: err.message });
    return error(res, 'Failed to fetch timeline', 500);
  }
});

/**
 * @swagger
 * /api/v1/metrics/histogram:
 *   get:
 *     tags: [Metrics]
 *     summary: Get processing time histogram
 *     responses:
 *       200: { description: Histogram data }
 */
router.get('/histogram', authMiddleware, async (req, res) => {
  try {
    const data = await metricsService.getProcessingTimeHistogram();
    return success(res, { histogram: data });
  } catch (err) {
    logger.error('Histogram fetch failed', { error: err.message });
    return error(res, 'Failed to fetch histogram', 500);
  }
});

module.exports = router;
