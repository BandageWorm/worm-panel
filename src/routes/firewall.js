const { Router } = require('express');
const firewall = require('../services/firewall');
const logger = require('../utils/logger');

const router = Router();

// 获取防火墙状态
router.get('/status', async (req, res) => {
  try {
    const status = await firewall.getStatus();
    res.json(status);
  } catch (e) {
    logger.error('Firewall', '获取状态失败', e);
    res.status(500).json({ error: e.message });
  }
});

// 获取规则列表
router.get('/rules', async (req, res) => {
  try {
    const rules = await firewall.getRules();
    res.json(rules);
  } catch (e) {
    logger.error('Firewall', '获取规则列表失败', e);
    res.status(500).json({ error: e.message });
  }
});

// 添加规则
router.post('/rules', async (req, res) => {
  try {
    const { port, protocol, action, from, ipVersion } = req.body;
    if (!port) {
      return res.status(400).json({ error: '端口不能为空' });
    }
    const result = await firewall.addRule({ port, protocol, action, from, ipVersion });
    res.json(result);
  } catch (e) {
    logger.error('Firewall', '添加规则失败', e);
    res.status(400).json({ error: e.message });
  }
});

// 删除规则
router.delete('/rules/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: '无效的规则编号' });
    }
    const result = await firewall.deleteRule(id);
    res.json(result);
  } catch (e) {
    logger.error('Firewall', `删除规则失败`, e);
    const status = e.message.includes('不能删除') ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

// 启用防火墙
router.post('/enable', async (req, res) => {
  try {
    const result = await firewall.enable();
    res.json(result);
  } catch (e) {
    logger.error('Firewall', '启用防火墙失败', e);
    res.status(500).json({ error: e.message });
  }
});

// 关闭防火墙
router.post('/disable', async (req, res) => {
  try {
    const result = await firewall.disable();
    res.json(result);
  } catch (e) {
    logger.error('Firewall', '关闭防火墙失败', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
