const { Router } = require('express');
const traffic = require('../services/traffic');

const router = Router();

// GET /api/traffic — 日/月流量用量与配额
router.get('/', (req, res) => {
  try {
    res.json(traffic.getSummary());
  } catch (err) {
    res.status(500).json({ error: '获取流量统计失败：' + (err.message || err) });
  }
});

module.exports = router;
