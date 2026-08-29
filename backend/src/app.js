// ============================================
// Express Application — Main Configuration
// ============================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./utils/swagger');
const { requestIdMiddleware } = require('./middleware/requestId.middleware');
const { error: errorResponse } = require('./utils/response');
const logger = require('./utils/logger');

// ── Routes ───────────────────────────────────────
const authRoutes = require('./routes/auth.routes');
const eventRoutes = require('./routes/event.routes');
const dlqRoutes = require('./routes/dlq.routes');
const metricsRoutes = require('./routes/metrics.routes');
const sseRoutes = require('./routes/sse.routes');
const simulatorRoutes = require('./routes/simulator.routes');
const apiKeyRoutes = require('./routes/apiKey.routes');

const { getRedisClient } = require('./utils/redis');
const { getPrismaClient } = require('./utils/prisma');

const app = express();

// ── Global Middleware ────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  exposedHeaders: [
    'X-Request-Id',
    'X-Idempotent-Replayed',
    'X-Idempotency-Key',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After',
  ],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);

// ── Request Logging ──────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health' && !req.path.startsWith('/api-docs')) {
      logger.info(`${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: res.locals.requestId,
      });
    }
  });
  next();
});

// ── Health Check ─────────────────────────────────
app.get('/health', async (req, res) => {
  let postgresOk = false;
  let redisOk = false;

  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    postgresOk = true;
  } catch {}

  try {
    const redis = getRedisClient();
    await redis.ping();
    redisOk = true;
  } catch {}

  const status = postgresOk && redisOk ? 'healthy' : 'degraded';
  const statusCode = status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    status,
    postgres: postgresOk,
    redis: redisOk,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Swagger API Docs ─────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'IEPS API Documentation',
}));

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── API Routes ───────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', sseRoutes);  // SSE route needs to be before event routes to match /events/stream
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/dlq', dlqRoutes);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/simulate', simulatorRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);

// ── 404 Handler ──────────────────────────────────
app.use((req, res) => {
  errorResponse(res, `Route not found: ${req.method} ${req.path}`, 404);
});

// ── Global Error Handler ─────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: res.locals.requestId,
  });

  errorResponse(res, 'Internal server error', 500);
});

module.exports = app;
