const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  } else if (statusCode >= 500) {
    // Still log server-side so the real cause isn't lost, just not sent to the client.
    console.error('Unhandled error:', err);
  }

  // Only expected 4xx messages (validation, "not found", etc.) are safe to
  // show verbatim — a raw 5xx error can leak internals (DB error text, file
  // paths, env var names). Genericize those outside development.
  const clientMessage = statusCode >= 500 && process.env.NODE_ENV !== 'development'
    ? 'Internal Server Error'
    : message;

  res.status(statusCode).json({
    success: false,
    error: clientMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
