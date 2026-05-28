const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const JWT_EXPIRES_IN = '48h';

function getJwtSecret() {
  // Priority: env var > config file > generate and persist
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  const configPath = path.join(__dirname, '..', '..', 'data', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg.jwtSecret) {
      return cfg.jwtSecret;
    }
  } catch {}

  // Generate a random secret and persist it
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    let cfg = {};
    if (fs.existsSync(configPath)) {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    cfg.jwtSecret = secret;
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {}

  return secret;
}

const JWT_SECRET = getJwtSecret();

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
