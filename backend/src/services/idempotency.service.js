// ============================================
// Idempotency Service — Core Engine
// ============================================
const { getRedisClient } = require('../utils/redis');
const { getPrismaClient } = require('../utils/prisma');
const logger = require('../utils/logger');

const TTL_SECONDS = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '86400', 10);

class IdempotencyService {
  constructor() {
    this.redis = getRedisClient();
    this.prisma = getPrismaClient();
  }

  /**
   * Check if an idempotency key has been seen before.
   * Returns { isDuplicate: boolean, cachedResponse?: object }
   */
  async checkKey(idempotencyKey) {
    const cacheKey = `idempotency:${idempotencyKey}`;

    // Check Redis first (fast path)
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      logger.info('Idempotency key found in Redis cache', { idempotencyKey });
      return { isDuplicate: true, cachedResponse: JSON.parse(cached) };
    }

    // Check PostgreSQL (permanent store)
    const stored = await this.prisma.idempotencyStore.findUnique({
      where: { key: idempotencyKey },
    });

    if (stored) {
      logger.info('Idempotency key found in PostgreSQL', { idempotencyKey });
      // Re-populate Redis cache
      await this.redis.setex(cacheKey, TTL_SECONDS, JSON.stringify(stored.responsePayload));
      return { isDuplicate: true, cachedResponse: stored.responsePayload };
    }

    return { isDuplicate: false };
  }

  /**
   * Store an idempotency key with its response in both Redis and PostgreSQL.
   */
  async storeKey(idempotencyKey, eventId, responsePayload) {
    const cacheKey = `idempotency:${idempotencyKey}`;
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);

    // Store in Redis with TTL
    await this.redis.setex(cacheKey, TTL_SECONDS, JSON.stringify(responsePayload));

    // Store in PostgreSQL as permanent audit log
    await this.prisma.idempotencyStore.upsert({
      where: { key: idempotencyKey },
      update: {
        responsePayload,
        eventId,
      },
      create: {
        key: idempotencyKey,
        eventId,
        responsePayload,
        expiresAt,
      },
    });

    logger.info('Idempotency key stored', { idempotencyKey, eventId });
  }

  /**
   * Get count of duplicate events blocked
   */
  async getDuplicateCount() {
    return this.prisma.idempotencyStore.count();
  }
}

module.exports = new IdempotencyService();
