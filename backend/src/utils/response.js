// ============================================
// Standardized API Response Wrapper
// ============================================
const { v4: uuidv4 } = require('uuid');

/**
 * Wraps all API responses in a consistent structure:
 * { success, data, error, requestId, timestamp }
 */
function success(res, data, statusCode = 200, headers = {}) {
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
    requestId: res.locals.requestId || uuidv4(),
    timestamp: new Date().toISOString(),
  });
}

function error(res, message, statusCode = 500, details = null) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: message,
    details,
    requestId: res.locals.requestId || uuidv4(),
    timestamp: new Date().toISOString(),
  });
}

function paginated(res, data, total, page, limit) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    error: null,
    requestId: res.locals.requestId || uuidv4(),
    timestamp: new Date().toISOString(),
  });
}

module.exports = { success, error, paginated };
