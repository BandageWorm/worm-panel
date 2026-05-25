const { Router } = require('express');
const { hashPassword } = require('../utils/crypto');
const config = require('../services/config');
const { validateSetupToken, clearSetupToken } = require('../services/setup');
const logger = require('../utils/logger');

const router = Router();

router.get('/status', (req, res) => {
  const cfg = config.load();
  res.json({
    initialized: cfg.initialized,
    mode: cfg.mode,
    port: cfg.port,
    domain: cfg.domain
  });
});

router.post('/setup', async (req, res) => {
  try {
    const { password, token, port, domain } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    if (!validateSetupToken(token)) {
      return res.status(403).json({ error: '设置 Token 无效' });
    }

    const cfg = config.load();
    cfg.passwordHash = await hashPassword(password);
    cfg.initialized = true;

    if (domain) {
      cfg.domain = domain;
      cfg.mode = 'proxy';
    }
    if (port) {
      cfg.port = parseInt(port, 10);
    }

    clearSetupToken();
    config.save(cfg);

    res.json({
      success: true,
      mode: cfg.mode,
      port: cfg.port,
      domain: cfg.domain,
      message: domain
        ? `面板已配置完成，请通过 https://${domain} 访问`
        : `面板已配置完成，请通过 http://${cfg.mode === 'proxy' ? '127.0.0.1' : '服务器IP'}:${cfg.port} 访问`
    });
  } catch (err) {
    logger.error('Setup', '初始化设置失败', err);
    res.status(500).json({ error: '设置失败' });
  }
});

module.exports = router;
