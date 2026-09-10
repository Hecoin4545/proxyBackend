const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — verifies JWT from Authorization header
 * Attaches req.user to the request if valid
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password -otpCode -otpExpiry');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (!req.user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account not verified. Please verify your email.' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

module.exports = { protect };
