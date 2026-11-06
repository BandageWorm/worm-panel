const { Router } = require('express');
const config = require('../services/config');
const nginx = require('../services/nginx');
const autosync = require('../services/autosync');
const { hashPassword } = require('../utils/crypto');
const logger = require('../utils/logger');

const router = Router();

// 功能设置的合法范围，超出则拒绝保存
const SETTING_LIMITS = {
  dashboardRefresh: { min: 2, max: 300, label: '仪表盘刷新间隔' },
  syncInterval: { min: 0, max: 168, label: '云备份自动同步周期' },
  editMaxSize: { min: 1, max: 50, label: '在线编辑文件上限' },
  uploadMaxSize: { min: 1, max: 20480, label: '上传大小上限' }
};

// GET /api/settings — 读取当前设置（不含敏感信息）
router.get('/', (req, res) => {
  const cfg = config.load();
  res.json({
    port: cfg.port,
    mode: cfg.mode,
    domain: cfg.domain,
    initialized: cfg.initialized,
    settings: config.getSettings(cfg)
  });
});

// 校验并写回 settings，返回错误信息数组
function applySettings(cfg, input) {
  if (!input || typeof input !== 'object') return [];
  const current = config.getSettings(cfg);
  const next = { ...current };
  const errors = [];

  for (const [key, limit] of Object.entries(SETTING_LIMITS)) {
    if (input[key] === undefined) continue;
    const value = Number(input[key]);
    if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
      errors.push(`${limit.label}必须是 ${limit.min}-${limit.max} 之间的整数`);
      continue;
    }
    next[key] = value;
  }

  if (errors.length === 0) {
    cfg.settings = next;
  }
  return errors;
}

// PUT /api/settings — 更新设置
router.put('/', async (req, res) => {
  try {
    const { port, mode, domain, password, settings } = req.body;
    const cfg = config.load();
    const oldMode = cfg.mode;
    const oldUploadMaxSize = config.getSettings(cfg).uploadMaxSize;
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
        return res.status(400).json({ error: '切换到 proxy 模式需要提供域名' });
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

    // 功能设置（刷新间隔 / 同步周期 / 文件大小上限）
    if (settings !== undefined) {
      const errors = applySettings(cfg, settings);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('；') });
      }
      changes.push('settings');
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

    // 上传上限变化时同步面板 nginx 的 client_max_body_size，否则会被 nginx 先拦成 413
    const uploadMaxSize = config.getSettings(cfg).uploadMaxSize;
    let nginxSynced = null;
    if (uploadMaxSize !== oldUploadMaxSize && cfg.mode === 'proxy' && cfg.domain) {
      try {
        const result = await nginx.applyClientMaxBodySize(cfg.domain, uploadMaxSize);
        nginxSynced = result.updated;
        if (result.updated.length > 0) changes.push('nginx-body-size');
      } catch (e) {
        logger.warn('Settings', `同步 nginx 上传上限失败: ${e.message}`);
        nginxSynced = { error: e.message };
      }
    }

    // 同步周期变化后重新排期，无需重启面板
    if (changes.includes('settings')) {
      autosync.start();
    }

    res.json({
      success: true,
      changes,
      nginxSynced,
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
