// ============================================
// DLQ Controller — Dead Letter Queue Management
// ============================================
const eventService = require('../services/event.service');
const { success, error, paginated } = require('../utils/response');
const logger = require('../utils/logger');

async function getDeadEvents(req, res) {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);

    const { events, total } = await eventService.getDeadEvents({ page, limit });
    return paginated(res, events, total, page, limit);
  } catch (err) {
    logger.error('Get dead events failed', { error: err.message });
    return error(res, 'Failed to fetch dead events', 500);
  }
}

async function replayDeadEvent(req, res) {
  try {
    const event = await eventService.replayDeadEvent(req.params.id);
    return success(res, { event, message: 'Dead event replayed successfully' });
  } catch (err) {
    logger.error('Replay dead event failed', { error: err.message });
    return error(res, err.message || 'Failed to replay dead event', 400);
  }
}

async function bulkReplayDeadEvents(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return error(res, 'Provide an array of event IDs', 400);
    }

    const results = [];
    const errors = [];

    for (const id of ids) {
      try {
        const event = await eventService.replayDeadEvent(id);
        results.push({ id, status: 'replayed' });
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }

    return success(res, {
      replayed: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (err) {
    logger.error('Bulk replay failed', { error: err.message });
    return error(res, 'Failed to bulk replay events', 500);
  }
}

async function discardDeadEvent(req, res) {
  try {
    await eventService.discardDeadEvent(req.params.id);
    return success(res, { message: 'Dead event discarded' });
  } catch (err) {
    logger.error('Discard dead event failed', { error: err.message });
    return error(res, err.message || 'Failed to discard dead event', 400);
  }
}

module.exports = { getDeadEvents, replayDeadEvent, bulkReplayDeadEvents, discardDeadEvent };
