// ============================================
// Redis Connection Factory
// ============================================
const Redis = require('ioredis');
const logger = require('./logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;
let subscriber = null;

function createRedisClient(name = 'default') {
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis ${name} reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  });

  redis.on('connect', () => {
    logger.info(`Redis ${name} connected`);
  });

  redis.on('error', (err) => {
    logger.error(`Redis ${name} error: ${err.message}`);
  });

  redis.on('close', () => {
    logger.warn(`Redis ${name} connection closed`);
  });

  return redis;
}

function getRedisClient() {
  if (!client) {
    client = createRedisClient('client');
  }
  return client;
}

function getRedisSubscriber() {
  if (!subscriber) {
    subscriber = createRedisClient('subscriber');
  }
  return subscriber;
}

async function closeRedisConnections() {
  const promises = [];
  if (client) {
    promises.push(client.quit());
    client = null;
  }
  if (subscriber) {
    promises.push(subscriber.quit());
    subscriber = null;
  }
  await Promise.all(promises);
  logger.info('All Redis connections closed');
}

module.exports = {
  createRedisClient,
  getRedisClient,
  getRedisSubscriber,
  closeRedisConnections,
};
