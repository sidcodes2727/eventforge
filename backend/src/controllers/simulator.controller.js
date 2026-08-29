// ============================================
// Simulator Controller — Webhook Duplicate Tester
// ============================================
const { v4: uuidv4 } = require('uuid');
const idempotencyService = require('../services/idempotency.service');
const eventService = require('../services/event.service');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const { getRedisClient } = require('../utils/redis');

async function simulateWebhook(req, res) {
  try {
    const {
      eventType = 'webhook.received',
      payload = { source: 'simulator', data: { test: true } },
      duplicateCount = 3,
      delayBetweenMs = 100,
      priority = 'medium',
    } = req.body;

    if (duplicateCount < 1 || duplicateCount > 10) {
      return error(res, 'duplicateCount must be between 1 and 10', 400);
    }

    // Generate a single idempotency key for all "duplicate" requests
    const idempotencyKey = uuidv4();
    const results = [];
    let processedCount = 0;
    let blockedCount = 0;

    for (let i = 0; i < duplicateCount; i++) {
      const requestStart = Date.now();

      try {
        // Check idempotency
        const { isDuplicate, cachedResponse } = await idempotencyService.checkKey(idempotencyKey);

        if (isDuplicate) {
          blockedCount++;
          results.push({
            attempt: i + 1,
            status: 'blocked',
            reason: 'duplicate',
            responseTimeMs: Date.now() - requestStart,
            cachedResponse,
          });
        } else {
          // Process the first (unique) event
          const event = await eventService.createEvent({
            type: eventType,
            payload: { ...payload, simulatorRun: true },
            metadata: { source: 'webhook-simulator', duplicateCount },
            priority,
            idempotencyKey,
          });

          // Store idempotency response
          const responsePayload = {
            eventId: event.id,
            type: event.type,
            status: event.status,
          };
          await idempotencyService.storeKey(idempotencyKey, event.id, responsePayload);

          // Track duplicate block metric
          const redis = getRedisClient();
          await redis.incr('metrics:duplicates_blocked');

          processedCount++;
          results.push({
            attempt: i + 1,
            status: 'processed',
            eventId: event.id,
            responseTimeMs: Date.now() - requestStart,
          });
        }
      } catch (err) {
        results.push({
          attempt: i + 1,
          status: 'error',
          error: err.message,
          responseTimeMs: Date.now() - requestStart,
        });
      }

      // Delay between requests
      if (i < duplicateCount - 1 && delayBetweenMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenMs));
      }
    }

    logger.info('Webhook simulation completed', {
      idempotencyKey,
      sent: duplicateCount,
      processed: processedCount,
      blocked: blockedCount,
    });

    return success(res, {
      idempotencyKey,
      eventType,
      sent: duplicateCount,
      processed: processedCount,
      duplicatesBlocked: blockedCount,
      results,
    });

  } catch (err) {
    logger.error('Webhook simulation failed', { error: err.message });
    return error(res, 'Simulation failed', 500);
  }
}

module.exports = { simulateWebhook };
