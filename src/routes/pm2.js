const { Router } = require('express');
const pm2 = require('../services/pm2');
const logger = require('../utils/logger');

const router = Router();

router.get('/processes', async (req, res) => {
  try {
    const processes = await pm2.list();
    res.json(processes);
  } catch (e) {
    logger.error('PM2', '获取进程列表失败', e);
    res.status(500).json({ error: 'PM2 连接失败: ' + e.message });
  }
});

router.post('/restart/:name', async (req, res) => {
  try {
    await pm2.restart(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `重启 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/stop/:name', async (req, res) => {
  try {
    await pm2.stop(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `停止 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/reload/:name', async (req, res) => {
  try {
    await pm2.reload(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `重载 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/logs/:name', (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 200;
    const logs = pm2.getLogs(req.params.name, lines);
    res.json({ logs });
  } catch (e) {
    logger.error('PM2', `获取日志 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/config', (req, res) => {
  try {
    const content = pm2.getConfig();
    res.json({ content });
  } catch (e) {
    logger.error('PM2', '获取配置失败', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/config', (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined) {
      return res.status(400).json({ error: '配置内容不能为空' });
    }
    pm2.saveConfig(content);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', '保存配置失败', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
