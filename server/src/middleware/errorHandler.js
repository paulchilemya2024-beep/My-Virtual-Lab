const config = require('../config/env');

// 404 handler for any unmatched route.
function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Central error handler. Express recognises it by its four arguments.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Mongoose duplicate-key (e.g. email already registered)
  if (err.code === 11000) {
    return res.status(409).json({ error: 'That value is already in use.', fields: err.keyValue });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const fields = Object.fromEntries(
      Object.entries(err.errors).map(([key, val]) => [key, val.message])
    );
    return res.status(400).json({ error: 'Validation failed', fields });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error('💥 Unhandled error:', err);
  }

  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(config.isProduction ? {} : { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
