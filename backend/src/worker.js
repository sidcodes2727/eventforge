// ============================================
// Worker Entry Point — Standalone Process
// ============================================
const logger = require('./utils/logger');
const { closeRedisConnections } = require('./utils/redis');
const { disconnectPrisma } = require('./utils/prisma');
const WorkerService = require('./services/worker.service');

const EventEmitter = require('events');
global.sseEmitter = new EventEmitter();
global.sseEmitter.setMaxListeners(100);

const worker = new WorkerService();

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  await worker.stop();

  // Wait a moment for in-flight events
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await closeRedisConnections();
  await disconnectPrisma();
  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception in worker', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in worker', { reason: String(reason) });
});

// Start worker
logger.info('=== Idempotent Event Processing System — Worker ===');
worker.start().catch((err) => {
  logger.error('Worker failed to start', { error: err.message });
  process.exit(1);
});
