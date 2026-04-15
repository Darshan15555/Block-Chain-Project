const rateLimit = require('express-rate-limit');

const verificationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Too many verification requests. Please try again after a minute.',
  },
});

module.exports = {
  verificationRateLimiter,
};
