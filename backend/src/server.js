// ============================================
// Server Entry Point — API Server
// ============================================
const EventEmitter = require('events');
const app = require('./app');
const logger = require('./utils/logger');
const { closeRedisConnections } = require('./utils/redis');
const { disconnectPrisma } = require('./utils/prisma');

// Global SSE emitter for real-time updates
global.sseEmitter = new EventEmitter();
global.sseEmitter.setMaxListeners(100);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info('=== Idempotent Event Processing System — API Server ===');
  logger.info(`Server running on port ${PORT}`);
  logger.info(`API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`Health: http://localhost:${PORT}/health`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ── Graceful Shutdown ────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await closeRedisConnections();
      await disconnectPrisma();
      logger.info('All connections closed. Shutdown complete.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

module.exports = server;
