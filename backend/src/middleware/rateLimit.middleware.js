// ============================================
// Rate Limiting Middleware — Redis Sliding Window
// ============================================
const { getRedisClient } = require('../utils/redis');
const { error } = require('../utils/response');
const logger = require('../utils/logger');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

/**
 * Sliding window rate limiter using Redis sorted sets.
 * Key: ratelimit:{identifier}
 * Each request adds a member with score = current timestamp.
 * We remove members outside the window, then count remaining.
 */
function rateLimitMiddleware(customLimit) {
  return async (req, res, next) => {
    try {
      const redis = getRedisClient();
      const identifier = req.headers['x-api-key'] || req.user?.id || req.ip;
      const key = `ratelimit:${identifier}`;
      const now = Date.now();
      const windowStart = now - WINDOW_MS;
      const limit = customLimit || MAX_REQUESTS;

      // Use a pipeline for atomicity
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);     // Remove expired entries
      pipeline.zadd(key, now, `${now}:${Math.random()}`); // Add current request
      pipeline.zcard(key);                                  // Count requests in window
      pipeline.expire(key, Math.ceil(WINDOW_MS / 1000));   // Set TTL

      const results = await pipeline.exec();
      const requestCount = results[2][1];

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - requestCount));
      res.setHeader('X-RateLimit-Reset', new Date(now + WINDOW_MS).toISOString());

      if (requestCount > limit) {
        const retryAfter = Math.ceil(WINDOW_MS / 1000);
        res.setHeader('Retry-After', retryAfter);
        logger.warn('Rate limit exceeded', { identifier, requestCount, limit });
        return error(res, `Rate limit exceeded. Try again in ${retryAfter} seconds.`, 429);
      }

      next();
    } catch (err) {
      // If Redis is down, allow the request through (fail open)
      logger.error('Rate limit check failed', { error: err.message });
      next();
    }
  };
}

module.exports = { rateLimitMiddleware };
