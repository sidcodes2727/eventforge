// ============================================
// Event Handlers — Registry & Dispatch
// ============================================
const logger = require('../utils/logger');

// ── Individual Handlers ──────────────────────────

const handlers = {
  'payment.success': async (event) => {
    logger.info('Processing payment.success', { eventId: event.id, amount: event.payload?.amount });
    // Simulate payment processing work
    await simulateWork(100, 300);
    return { processed: true, action: 'payment_confirmed', amount: event.payload?.amount };
  },

  'payment.failed': async (event) => {
    logger.info('Processing payment.failed', { eventId: event.id });
    await simulateWork(50, 200);
    return { processed: true, action: 'payment_failure_logged', reason: event.payload?.reason };
  },

  'order.placed': async (event) => {
    logger.info('Processing order.placed', { eventId: event.id, orderId: event.payload?.orderId });
    await simulateWork(150, 400);
    return { processed: true, action: 'order_created', orderId: event.payload?.orderId };
  },

  'order.cancelled': async (event) => {
    logger.info('Processing order.cancelled', { eventId: event.id });
    await simulateWork(100, 250);
    return { processed: true, action: 'order_cancelled', refund: true };
  },

  'user.signup': async (event) => {
    logger.info('Processing user.signup', { eventId: event.id, email: event.payload?.email });
    await simulateWork(200, 500);
    return { processed: true, action: 'welcome_email_sent', email: event.payload?.email };
  },

  'notification.send': async (event) => {
    logger.info('Processing notification.send', { eventId: event.id, channel: event.payload?.channel });
    await simulateWork(50, 150);
    return { processed: true, action: 'notification_delivered', channel: event.payload?.channel };
  },

  'webhook.received': async (event) => {
    logger.info('Processing webhook.received', { eventId: event.id, source: event.payload?.source });
    await simulateWork(100, 300);
    return { processed: true, action: 'webhook_processed', source: event.payload?.source };
  },
};

// ── Simulate async work with random duration ─────
async function simulateWork(minMs, maxMs) {
  const duration = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, duration));
}

// ── Dispatch ─────────────────────────────────────

async function dispatch(event) {
  const handler = handlers[event.type];
  if (!handler) {
    throw new Error(`No handler registered for event type: ${event.type}`);
  }
  return handler(event);
}

function getRegisteredTypes() {
  return Object.keys(handlers);
}

module.exports = { dispatch, getRegisteredTypes, handlers };
