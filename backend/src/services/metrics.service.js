// ============================================
// Metrics Service — Aggregate System Metrics
// ============================================
const { getRedisClient } = require('../utils/redis');
const { getPrismaClient } = require('../utils/prisma');
const queueService = require('./queue.service');
const logger = require('../utils/logger');

class MetricsService {
  constructor() {
    this.redis = getRedisClient();
    this.prisma = getPrismaClient();
    this.startTime = Date.now();
  }

  /**
   * Get comprehensive system metrics.
   */
  async getMetrics() {
    const [
      eventsByStatus,
      eventsByType,
      totalEvents,
      avgProcessingTime,
      queueDepth,
      duplicatesBlocked,
      recentThroughput,
    ] = await Promise.all([
      this.getEventsByStatus(),
      this.getEventsByType(),
      this.getTotalEvents(),
      this.getAvgProcessingTime(),
      queueService.getQueueDepth(),
      this.getDuplicatesBlocked(),
      this.getThroughputPerMinute(),
    ]);

    const totalProcessed = eventsByStatus.processed || 0;
    const totalFailed = eventsByStatus.failed || 0;
    const totalDead = eventsByStatus.dead || 0;

    const totalReceived = totalEvents + duplicatesBlocked;
    const duplicateRatePercent = totalReceived > 0
      ? parseFloat(((duplicatesBlocked / totalReceived) * 100).toFixed(2))
      : 0;

    // Determine system health
    let systemHealth = 'healthy';
    if (queueDepth.high > 1000 || totalDead > 50) {
      systemHealth = 'degraded';
    }
    if (queueDepth.high > 5000 || totalDead > 200) {
      systemHealth = 'down';
    }

    return {
      totalEventsReceived: totalReceived,
      totalProcessed,
      totalDuplicatesBlocked: duplicatesBlocked,
      totalFailed,
      totalDead,
      avgProcessingTimeMs: avgProcessingTime,
      eventsByType,
      eventsByStatus,
      queueDepth,
      throughputPerMinute: recentThroughput,
      duplicateRatePercent,
      systemHealth,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  async getTotalEvents() {
    return this.prisma.event.count();
  }

  async getEventsByStatus() {
    const results = await this.prisma.event.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const statusMap = {};
    for (const r of results) {
      statusMap[r.status] = r._count.status;
    }
    return statusMap;
  }

  async getEventsByType() {
    const results = await this.prisma.event.groupBy({
      by: ['type'],
      _count: { type: true },
    });

    const typeMap = {};
    for (const r of results) {
      typeMap[r.type] = r._count.type;
    }
    return typeMap;
  }

  async getAvgProcessingTime() {
    const result = await this.prisma.event.aggregate({
      _avg: { processingTimeMs: true },
      where: { processingTimeMs: { not: null } },
    });
    return Math.round(result._avg.processingTimeMs || 0);
  }

  async getDuplicatesBlocked() {
    try {
      const count = await this.redis.get('metrics:duplicates_blocked');
      return parseInt(count || '0', 10);
    } catch {
      return 0;
    }
  }

  async getThroughputPerMinute() {
    try {
      // Count events processed in the last minute
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const count = await this.prisma.event.count({
        where: {
          processedAt: { gte: oneMinuteAgo },
          status: 'processed',
        },
      });
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Get events over time for chart data (last 24 hours, grouped by hour).
   */
  async getEventsOverTime(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const events = await this.prisma.$queryRaw`
      SELECT
        date_trunc('hour', created_at) as hour,
        status,
        COUNT(*)::int as count
      FROM events
      WHERE created_at >= ${since}
      GROUP BY date_trunc('hour', created_at), status
      ORDER BY hour ASC
    `;

    return events;
  }

  /**
   * Get processing time histogram data.
   */
  async getProcessingTimeHistogram() {
    const events = await this.prisma.$queryRaw`
      SELECT
        CASE
          WHEN processing_time_ms < 100 THEN '0-100ms'
          WHEN processing_time_ms < 250 THEN '100-250ms'
          WHEN processing_time_ms < 500 THEN '250-500ms'
          WHEN processing_time_ms < 1000 THEN '500ms-1s'
          ELSE '1s+'
        END as bucket,
        COUNT(*)::int as count
      FROM events
      WHERE processing_time_ms IS NOT NULL
      GROUP BY bucket
      ORDER BY MIN(processing_time_ms)
    `;

    return events;
  }
}

module.exports = new MetricsService();
