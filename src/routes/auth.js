const { Router } = require('express');
const { comparePassword, signToken } = require('../utils/crypto');
const config = require('../services/config');
const logger = require('../utils/logger');

const router = Router();

router.post('/login', async (req, res) => {
  try {
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
      return res.status(401).json({ error: '密码错误' });
    }

    const token = signToken();
    res.json({ token });
  } catch (err) {
    logger.error('Auth', '登录失败', err);
    res.status(500).json({ error: '登录失败' });
  }
});

module.exports = router;
