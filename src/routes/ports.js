const { Router } = require('express');
const ports = require('../services/ports');
const logger = require('../utils/logger');

const router = Router();

// GET /api/ports —— 监听端口（含归属与标记）
router.get('/', async (req, res) => {
  try {
    const list = await ports.listPorts();
    res.json({ ports: list, total: list.length });
  } catch (err) {
    logger.error('Ports', '获取端口列表失败', err);
    res.status(500).json({ error: '获取端口列表失败：' + (err.message || err) });
  }
});

// GET /api/ports/processes?limit=50&sort=cpu|mem
router.get('/processes', async (req, res) => {
  try {
    const list = await ports.listProcesses({
      limit: req.query.limit,
      sort: req.query.sort
    });
    res.json({ processes: list, total: list.length });
  } catch (err) {
    logger.error('Ports', '获取进程列表失败', err);
    res.status(500).json({ error: '获取进程列表失败：' + (err.message || err) });
  }
});

// POST /api/ports/kill —— 终止进程（服务端硬校验保护清单）
router.post('/kill', async (req, res) => {
  try {
    const { pid, signal } = req.body || {};
    const result = await ports.killProcess(pid, signal);
    res.json(result);
  } catch (err) {
    logger.warn('Ports', `终止进程失败: ${err.message || err}`);
    res.status(400).json({ error: err.message || '终止进程失败' });
  }
});

module.exports = router;
