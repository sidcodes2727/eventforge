// ============================================
// Environment Configuration with Validation
// ============================================
const { cleanEnv, str, port, num, bool } = require('envalid');

const config = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  PORT: port({ default: 3000 }),

  // Database
  DATABASE_URL: str(),

  // Redis
  REDIS_URL: str({ default: 'redis://localhost:6379' }),
  REDIS_HOST: str({ default: 'localhost' }),
  REDIS_PORT: port({ default: 6379 }),

  // JWT
  JWT_SECRET: str(),
  JWT_EXPIRES_IN: str({ default: '7d' }),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: num({ default: 60000 }),
  RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),

  // Idempotency
  IDEMPOTENCY_TTL_SECONDS: num({ default: 86400 }),

  // Worker
  WORKER_CONCURRENCY: num({ default: 3 }),
  MAX_RETRIES: num({ default: 5 }),
  STREAM_MAX_LEN: num({ default: 10000 }),

  // Logging
  LOG_LEVEL: str({ default: 'info' }),

  // Frontend
  FRONTEND_URL: str({ default: 'http://localhost:5173' }),
});

module.exports = config;
