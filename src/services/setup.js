const crypto = require('crypto');
const config = require('./config');

function generateSetupToken() {
  const cfg = config.load();
  const token = crypto.randomBytes(16).toString('hex');
  cfg.setupToken = token;
  config.save(cfg);
  return token;
}

function validateSetupToken(token) {
  const cfg = config.load();
  return cfg.setupToken && cfg.setupToken === token;
}

function clearSetupToken() {
  const cfg = config.load();
  cfg.setupToken = null;
  config.save(cfg);
}

module.exports = { generateSetupToken, validateSetupToken, clearSetupToken };
