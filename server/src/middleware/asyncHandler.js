// Wraps an async route handler so any thrown error / rejected promise is
// forwarded to Express's error handler instead of crashing the process.
// Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
