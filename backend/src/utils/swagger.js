// ============================================
// Swagger / OpenAPI Configuration
// ============================================
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Idempotent Event Processing System API',
      version: '1.0.0',
      description: 'Production-grade event processing with idempotency guarantees, Redis Streams queuing, and dead letter queue management.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            idempotencyKey: { type: 'string' },
            type: { type: 'string', enum: ['payment.success', 'payment.failed', 'order.placed', 'order.cancelled', 'user.signup', 'notification.send', 'webhook.received'] },
            payload: { type: 'object' },
            metadata: { type: 'object' },
            status: { type: 'string', enum: ['pending', 'processing', 'processed', 'failed', 'dead'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            retryCount: { type: 'integer' },
            processingTimeMs: { type: 'integer', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', nullable: true },
            error: { type: 'string', nullable: true },
            requestId: { type: 'string', format: 'uuid' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
