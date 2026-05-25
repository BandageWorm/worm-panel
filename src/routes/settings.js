const { Router } = require('express');
const { execSync } = require('child_process');
const config = require('../services/config');
const nginx = require('../services/nginx');
const { hashPassword } = require('../utils/crypto');
const logger = require('../utils/logger');

const router = Router();

// GET /api/settings — 读取当前设置（不含敏感信息）
router.get('/', (req, res) => {
  const cfg = config.load();
  res.json({
    port: cfg.port,
    mode: cfg.mode,
    domain: cfg.domain,
    initialized: cfg.initialized
  });
});

// PUT /api/settings — 更新设置
router.put('/', async (req, res) => {
  try {
    const { port, mode, domain, password } = req.body;
    const cfg = config.load();
    const oldMode = cfg.mode;
    const oldDomain = cfg.domain;
    const changes = [];

    // 更新端口
    if (port !== undefined) {
      const p = parseInt(port, 10);
      if (isNaN(p) || p < 1024 || p > 65535) {
        return res.status(400).json({ error: '端口必须在 1024-65535 之间' });
      }
      cfg.port = p;
      changes.push('port');
    }

    // 更新模式
    if (mode !== undefined) {
      if (mode !== 'standalone' && mode !== 'proxy') {
        return res.status(400).json({ error: '模式必须是 standalone 或 proxy' });
      }
      if (mode === 'proxy' && !domain && !cfg.domain) {
        // If switching to proxy but no domain provided and none currently set
        // We'll let it pass and be handled by the domain check below
      }
      cfg.mode = mode;
      changes.push('mode');
    }

    // 更新域名
    if (domain !== undefined) {
      cfg.domain = domain || null;
      changes.push('domain');
    }

    // 更新密码
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: '密码至少 6 位' });
      }
      cfg.passwordHash = await hashPassword(password);
      changes.push('password');
    }

    // 写入配置
    config.save(cfg);

    // 如果切换到 proxy 模式且有域名，更新 nginx 面板配置
    if (cfg.mode === 'proxy' && cfg.domain) {
      try {
        nginx.writeSelfConfig();
        changes.push('nginx-config');
      } catch (e) {
        logger.warn('Settings', `写入 nginx 配置失败: ${e.message}`);
      }
    }

    // 如果从 proxy 切回 standalone，移除面板的 nginx 配置
    if (cfg.mode === 'standalone' && oldMode === 'proxy') {
      try {
        nginx.writeSelfConfig();
        changes.push('nginx-config-removed');
      } catch (e) {
        logger.warn('Settings', `清理 nginx 配置失败: ${e.message}`);
      }
    }

    res.json({
      success: true,
      changes,
      needsRestart: changes.includes('mode') || changes.includes('port'),
      message: '设置已保存'
    });
  } catch (err) {
    logger.error('Settings', '更新设置失败', err);
    res.status(500).json({ error: err.message || '更新设置失败' });
  }
});

// PUT /api/settings/password — 单独修改密码
router.put('/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }
    const cfg = config.load();
    cfg.passwordHash = await hashPassword(password);
    config.save(cfg);
    res.json({ success: true, message: '密码已修改' });
  } catch (err) {
    logger.error('Settings', '修改密码失败', err);
    res.status(500).json({ error: err.message || '修改密码失败' });
  }
});

// POST /api/settings/restart — 重启面板
router.post('/restart', (req, res) => {
  try {
    // 先返回成功响应，再异步重启
    res.json({ success: true, message: '面板正在重启...' });

    // 关闭当前进程，systemd 会自动重启
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (err) {
    logger.error('Settings', '重启面板失败', err);
    // 如果还未响应，发送错误
    if (!res.headersSent) {
      res.status(500).json({ error: '重启失败' });
    }
  }
});

module.exports = router;
