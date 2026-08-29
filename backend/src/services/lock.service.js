// ============================================
// Distributed Lock Service — Redis SET NX PX
// ============================================
const { getRedisClient } = require('../utils/redis');
const logger = require('../utils/logger');

// Lua script for safe lock release (only release if we own it)
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

class LockService {
  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Acquire a distributed lock.
   * @param {string} resourceId - The resource to lock (e.g., event ID)
   * @param {number} ttlMs - Lock TTL in milliseconds (default: 30 seconds)
   * @returns {{ acquired: boolean, lockValue: string }}
   */
  async acquire(resourceId, ttlMs = 30000) {
    const lockKey = `lock:event:${resourceId}`;
    const lockValue = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    const result = await this.redis.set(lockKey, lockValue, 'NX', 'PX', ttlMs);

    if (result === 'OK') {
      logger.debug('Lock acquired', { resourceId, lockValue });
      return { acquired: true, lockValue };
    }

    logger.debug('Lock acquisition failed (already held)', { resourceId });
    return { acquired: false, lockValue: null };
  }

  /**
   * Release a distributed lock using Lua script for safety.
   * Only releases if we still own the lock.
   */
  async release(resourceId, lockValue) {
    const lockKey = `lock:event:${resourceId}`;

    const result = await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockValue);

    if (result === 1) {
      logger.debug('Lock released', { resourceId });
      return true;
    }

    logger.warn('Lock release failed (not owner or expired)', { resourceId });
    return false;
  }

  /**
   * Extend a lock's TTL (for long-running operations).
   */
  async extend(resourceId, lockValue, ttlMs = 30000) {
    const lockKey = `lock:event:${resourceId}`;

    const current = await this.redis.get(lockKey);
    if (current === lockValue) {
      await this.redis.pexpire(lockKey, ttlMs);
      logger.debug('Lock extended', { resourceId, ttlMs });
      return true;
    }

    return false;
  }
}

module.exports = new LockService();
