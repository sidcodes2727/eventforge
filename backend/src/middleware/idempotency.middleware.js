// ============================================
// Idempotency Middleware — Express Integration
// ============================================
const idempotencyService = require('../services/idempotency.service');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Middleware that enforces idempotency on event ingestion.
 * Requires `Idempotency-Key` header (UUID format).
 * If duplicate: returns cached response with X-Idempotent-Replayed: true
 * If new: continues to next handler
 */
async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return error(res, 'Idempotency-Key header is required.', 400);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idempotencyKey)) {
    return error(res, 'Idempotency-Key must be a valid UUID.', 400);
  }

  try {
    const { isDuplicate, cachedResponse } = await idempotencyService.checkKey(idempotencyKey);

    if (isDuplicate) {
      logger.info('Duplicate event detected, returning cached response', { idempotencyKey });

      // Track duplicate count in Redis
      const redis = require('../utils/redis').getRedisClient();
      await redis.incr('metrics:duplicates_blocked');

      return success(res, cachedResponse, 200, {
        'X-Idempotent-Replayed': 'true',
        'X-Idempotency-Key': idempotencyKey,
      });
    }

    // Store the idempotency key on res.locals for the controller to use
    res.locals.idempotencyKey = idempotencyKey;
    next();
  } catch (err) {
    logger.error('Idempotency check failed', { error: err.message, idempotencyKey });
    return error(res, 'Idempotency check failed. Please retry.', 500);
  }
}

module.exports = { idempotencyMiddleware };
