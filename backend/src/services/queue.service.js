// ============================================
// Queue Service — Redis Streams
// ============================================
const { getRedisClient } = require('../utils/redis');
const logger = require('../utils/logger');

const STREAM_MAX_LEN = parseInt(process.env.STREAM_MAX_LEN || '10000', 10);

// Stream names per priority
const STREAMS = {
  high: 'events:high',
  medium: 'events:medium',
  low: 'events:low',
};

const DEAD_LETTER_STREAM = 'events:dead-letter';
const CONSUMER_GROUP = 'event-processors';

class QueueService {
  constructor() {
    this.redis = getRedisClient();
  }

  /**
   * Initialize consumer groups for all streams.
   * Called once on worker startup.
   */
  async initializeStreams() {
    for (const [priority, stream] of Object.entries(STREAMS)) {
      try {
        await this.redis.xgroup('CREATE', stream, CONSUMER_GROUP, '0', 'MKSTREAM');
        logger.info(`Consumer group created for ${stream}`);
      } catch (err) {
        if (err.message.includes('BUSYGROUP')) {
          logger.debug(`Consumer group already exists for ${stream}`);
        } else {
          throw err;
        }
      }
    }

    // Initialize dead letter stream group
    try {
      await this.redis.xgroup('CREATE', DEAD_LETTER_STREAM, CONSUMER_GROUP, '0', 'MKSTREAM');
      logger.info(`Consumer group created for ${DEAD_LETTER_STREAM}`);
    } catch (err) {
      if (!err.message.includes('BUSYGROUP')) {
        throw err;
      }
    }
  }

  /**
   * Enqueue an event to the appropriate priority stream.
   */
  async enqueue(eventId, priority, eventData) {
    const stream = STREAMS[priority] || STREAMS.medium;

    const messageId = await this.redis.xadd(
      stream,
      'MAXLEN', '~', STREAM_MAX_LEN,
      '*',
      'eventId', eventId,
      'type', eventData.type,
      'priority', priority,
      'payload', JSON.stringify(eventData.payload),
      'metadata', JSON.stringify(eventData.metadata || {}),
      'enqueuedAt', new Date().toISOString()
    );

    logger.info('Event enqueued', { eventId, stream, messageId, priority });

    // Track queue depth metric
    await this.redis.incr(`metrics:enqueued:${priority}`);

    return messageId;
  }

  /**
   * Read events from streams using XREADGROUP.
   * Returns array of { stream, messageId, data } objects.
   */
  async readEvents(consumerName, count = 5, blockMs = 2000) {
    const streams = Object.values(STREAMS);
    const ids = streams.map(() => '>');

    try {
      const results = await this.redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, consumerName,
        'COUNT', count,
        'BLOCK', blockMs,
        'STREAMS', ...streams, ...ids
      );

      if (!results) return [];

      const events = [];
      for (const [stream, messages] of results) {
        for (const [messageId, fields] of messages) {
          // Convert flat array to object
          const data = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
          }
          // Parse JSON fields
          try { data.payload = JSON.parse(data.payload); } catch {}
          try { data.metadata = JSON.parse(data.metadata); } catch {}

          events.push({ stream, messageId, data });
        }
      }

      return events;
    } catch (err) {
      if (err.message.includes('NOGROUP')) {
        await this.initializeStreams();
        return [];
      }
      throw err;
    }
  }

  /**
   * Acknowledge a processed message.
   */
  async acknowledge(stream, messageId) {
    await this.redis.xack(stream, CONSUMER_GROUP, messageId);
    logger.debug('Message acknowledged', { stream, messageId });
  }

  /**
   * Move an event to the dead letter stream.
   */
  async moveToDeadLetter(eventId, eventData, errorMessage, errorStack) {
    await this.redis.xadd(
      DEAD_LETTER_STREAM,
      'MAXLEN', '~', STREAM_MAX_LEN,
      '*',
      'eventId', eventId,
      'type', eventData.type || 'unknown',
      'payload', JSON.stringify(eventData.payload || {}),
      'metadata', JSON.stringify(eventData.metadata || {}),
      'errorMessage', errorMessage || 'Unknown error',
      'errorStack', errorStack || '',
      'movedAt', new Date().toISOString()
    );

    logger.warn('Event moved to dead letter stream', { eventId });
  }

  /**
   * Get queue depth for all priority streams.
   */
  async getQueueDepth() {
    const depths = {};
    for (const [priority, stream] of Object.entries(STREAMS)) {
      try {
        const info = await this.redis.xlen(stream);
        depths[priority] = info;
      } catch {
        depths[priority] = 0;
      }
    }

    try {
      depths.deadLetter = await this.redis.xlen(DEAD_LETTER_STREAM);
    } catch {
      depths.deadLetter = 0;
    }

    return depths;
  }

  /**
   * Get dead letter stream entries.
   */
  async getDeadLetterEntries(count = 100) {
    try {
      const entries = await this.redis.xrange(DEAD_LETTER_STREAM, '-', '+', 'COUNT', count);

      return entries.map(([messageId, fields]) => {
        const data = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }
        try { data.payload = JSON.parse(data.payload); } catch {}
        try { data.metadata = JSON.parse(data.metadata); } catch {}
        return { messageId, ...data };
      });
    } catch {
      return [];
    }
  }
}

module.exports = new QueueService();
