const { Router } = require('express');
const xui = require('../services/xui');
const logger = require('../utils/logger');

const router = Router();

router.get('/status', (req, res) => {
  res.json(xui.getStatus());
});

router.get('/info', (req, res) => {
  res.json(xui.getStatus());
});

router.post('/proxy', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: '域名不能为空' });
    }
    const result = await xui.setProxy(domain);
    res.json(result);
  } catch (e) {
    logger.error('XUI', `设置反代失败: ${req.body?.domain}`, e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/proxy', async (req, res) => {
  try {
    const result = await xui.removeProxy();
    res.json(result);
  } catch (e) {
    logger.error('XUI', '删除反代失败', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/proxy', (req, res) => {
  const proxy = xui.getProxy();
  res.json(proxy || {});
});

module.exports = router;
