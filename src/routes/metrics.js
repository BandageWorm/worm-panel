const { Router } = require('express');
const metrics = require('../services/metrics');
const traffic = require('../services/traffic');

const router = Router();

// GET /api/metrics/history?range=1h|24h|7d
router.get('/history', (req, res) => {
  const range = String(req.query.range || '1h');
  const result = metrics.query(range);
  if (!result) {
    return res.status(400).json({ error: '不支持的区间，可选值：1h、24h、7d' });
  }
  res.json(result);
});

// GET /api/metrics/latest
router.get('/latest', (req, res) => {
  res.json(metrics.getLatest() || {});
});

// GET /api/metrics/traffic — 流量统计汇总
router.get('/traffic', (req, res) => {
  try {
    res.json(traffic.getSummary());
  } catch (err) {
    res.status(500).json({ error: '获取流量统计失败：' + (err.message || err) });
  }
});

module.exports = router;
