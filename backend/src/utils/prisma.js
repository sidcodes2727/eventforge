// ============================================
// Prisma Client Singleton
// ============================================
const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

let prisma = null;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    prisma.$on('error', (e) => {
      logger.error('Prisma error', { message: e.message, target: e.target });
    });

    prisma.$on('warn', (e) => {
      logger.warn('Prisma warning', { message: e.message });
    });
  }

  return prisma;
}

async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    logger.info('Prisma disconnected');
  }
}

module.exports = {
  getPrismaClient,
  disconnectPrisma,
};
