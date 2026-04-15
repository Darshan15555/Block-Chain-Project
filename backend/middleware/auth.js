const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-only-change-me';
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      name: user.name,
      username: user.username,
    },
    getJwtSecret(),
    { expiresIn: '12h' }
  );
}

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication token missing' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.sub).select('_id name username role walletAddress');

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid token user' });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      role: user.role,
      walletAddress: user.walletAddress,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: ${req.user.role} cannot perform this action`,
      });
    }

    return next();
  };
}

module.exports = {
  signToken,
  authenticateToken,
  requireRoles,
};
