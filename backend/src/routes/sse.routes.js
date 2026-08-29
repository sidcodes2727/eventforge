// ============================================
// SSE Routes — Server-Sent Events
// ============================================
const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = Router();

/**
 * @swagger
 * /api/v1/events/stream:
 *   get:
 *     tags: [Events]
 *     summary: Real-time event stream via Server-Sent Events
 *     responses:
 *       200:
 *         description: SSE stream of processed events
 *         content:
 *           text/event-stream: {}
 */
router.get('/stream', authMiddleware, (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Listen for events from the global emitter
  const onEvent = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      logger.error('SSE write error', { error: err.message });
    }
  };

  if (global.sseEmitter) {
    global.sseEmitter.on('event', onEvent);
  }

  // Heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    if (global.sseEmitter) {
      global.sseEmitter.removeListener('event', onEvent);
    }
    logger.debug('SSE client disconnected');
  });
});

module.exports = router;
