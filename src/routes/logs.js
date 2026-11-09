const { Router } = require('express');
const logs = require('../services/logs');
const logger = require('../utils/logger');

const router = Router();

// GET /api/logs/sources —— 可用日志源与文件列表
router.get('/sources', (req, res) => {
  try {
    res.json({ sources: logs.listSources() });
  } catch (err) {
    logger.error('Logs', '获取日志源失败', err);
    res.status(500).json({ error: '获取日志源失败：' + (err.message || err) });
  }
});

// GET /api/logs?source=nginx&file=<fileId>&lines=200&keyword=xxx
router.get('/', async (req, res) => {
  try {
    const result = await logs.readLog({
      sourceId: req.query.source,
      fileId: req.query.file,
      lines: req.query.lines,
      keyword: req.query.keyword
    });
    res.json(result);
  } catch (err) {
    logger.warn('Logs', `读取日志失败: ${err.message || err}`);
    res.status(400).json({ error: err.message || '读取日志失败' });
  }
});

module.exports = router;
