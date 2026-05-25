const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'worm-panel-secret-change-in-production';
const JWT_EXPIRES_IN = '48h';

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken() {
  return jwt.sign({ sub: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken, JWT_SECRET };
