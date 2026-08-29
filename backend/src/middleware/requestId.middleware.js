// ============================================
// Request ID Middleware
// ============================================
const { v4: uuidv4 } = require('uuid');

/**
 * Generates a unique request ID for every incoming request.
 * Attaches it to res.locals and response headers.
 */
function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = { requestIdMiddleware };
