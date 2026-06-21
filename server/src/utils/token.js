const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Create a signed login token that proves who the user is.
function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// Verify a token and return its payload, or throw if invalid/expired.
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = { signToken, verifyToken };
