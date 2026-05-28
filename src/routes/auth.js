const { Router } = require('express');
const { comparePassword, signToken } = require('../utils/crypto');
const config = require('../services/config');
const logger = require('../utils/logger');

const router = Router();

// Simple in-memory rate limiter for login
const loginAttempts = new Map(); // ip -> { count, lastAttempt }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return true;

  // Reset if lockout period has passed
  if (Date.now() - record.lastAttempt > LOCKOUT_MS) {
    loginAttempts.delete(ip);
    return true;
  }

  return record.count < MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const record = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  loginAttempts.set(ip, record);
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: '登录尝试过多，请 5 分钟后再试' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: '请输入密码' });
    }

    const cfg = config.load();
    if (!cfg.initialized) {
      return res.status(400).json({ error: '面板尚未初始化，请先完成首次设置' });
    }

    const valid = await comparePassword(password, cfg.passwordHash);
    if (!valid) {
      recordFailedAttempt(ip);
      return res.status(401).json({ error: '密码错误' });
    }

    clearAttempts(ip);
    const token = signToken();
    res.json({ token });
  } catch (err) {
    logger.error('Auth', '登录失败', err);
    res.status(500).json({ error: '登录失败' });
  }
});

module.exports = router;
