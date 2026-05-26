const { Router } = require('express');
const sync = require('../services/sync');
const logger = require('../utils/logger');

const router = Router();

// GET /api/sync/status — 连接状态、容量信息、最近同步时间
router.get('/status', async (req, res) => {
  try {
    const status = await sync.getStatus();
    res.json(status);
  } catch (e) {
    logger.error('Sync', '获取状态失败', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sync/auth-url — 生成阿里云盘授权指引
router.post('/auth-url', async (req, res) => {
  try {
    const result = sync.generateAuthUrl();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sync/auth-complete — 提交 WebDAV 连接信息完成配置
router.post('/auth-complete', async (req, res) => {
  try {
    const { url, user, password } = req.body;
    if (!url || !password) {
      return res.status(400).json({ error: 'WebDAV 地址和密码不能为空' });
    }
    const result = await sync.completeAuth({ url, user, password });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/sync/disconnect — 断开连接
router.post('/disconnect', (req, res) => {
  sync.disconnect();
  res.json({ success: true });
});

// POST /api/sync/backup — 立即备份
router.post('/backup', async (req, res) => {
  try {
    const result = await sync.backup();
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/sync/restore — 从云端恢复
router.post('/restore', async (req, res) => {
  try {
    const result = await sync.restore();
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/sync/history — 备份历史
router.get('/history', (req, res) => {
  try {
    const history = sync.getHistory();
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
