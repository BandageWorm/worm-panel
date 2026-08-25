const { Router } = require('express');
const systemd = require('../services/systemd');
const logger = require('../utils/logger');

const router = Router();

// 获取服务列表
router.get('/services', async (req, res) => {
  try {
    const services = await systemd.listServices();
    res.json(services);
  } catch (e) {
    logger.error('Systemd', '获取服务列表失败', e);
    res.status(500).json({ error: '获取服务列表失败: ' + e.message });
  }
});

// 获取单个服务详情
router.get('/services/:name', async (req, res) => {
  try {
    const detail = await systemd.getServiceDetail(req.params.name);
    res.json(detail);
  } catch (e) {
    logger.error('Systemd', `获取 ${req.params.name} 详情失败`, e);
    res.status(500).json({ error: e.message });
  }
});

// 获取服务日志
router.get('/services/:name/logs', async (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 100;
    const logs = await systemd.getServiceLogs(req.params.name, lines);
    res.json({ logs });
  } catch (e) {
    logger.error('Systemd', `获取 ${req.params.name} 日志失败`, e);
    res.status(500).json({ error: e.message });
  }
});

// 启动服务
router.post('/services/:name/start', async (req, res) => {
  try {
    const result = await systemd.controlService(req.params.name, 'start');
    logger.info('Systemd', `启动 ${req.params.name} 成功`);
    res.json(result);
  } catch (e) {
    logger.error('Systemd', `启动 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

// 停止服务
router.post('/services/:name/stop', async (req, res) => {
  try {
    const result = await systemd.controlService(req.params.name, 'stop');
    logger.info('Systemd', `停止 ${req.params.name} 成功`);
    res.json(result);
  } catch (e) {
    logger.error('Systemd', `停止 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

// 重启服务
router.post('/services/:name/restart', async (req, res) => {
  try {
    const result = await systemd.controlService(req.params.name, 'restart');
    logger.info('Systemd', `重启 ${req.params.name} 成功`);
    res.json(result);
  } catch (e) {
    logger.error('Systemd', `重启 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

// 重载服务
router.post('/services/:name/reload', async (req, res) => {
  try {
    const result = await systemd.controlService(req.params.name, 'reload');
    logger.info('Systemd', `重载 ${req.params.name} 成功`);
    res.json(result);
  } catch (e) {
    logger.error('Systemd', `重载 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

// 启用开机自启
router.post('/services/:name/enable', async (req, res) => {
  try {
    const result = await systemd.controlService(req.params.name, 'enable');
    logger.info('Systemd', `启用 ${req.params.name} 开机自启`);
    res.json(result);
  } catch (e) {
    logger.error('Systemd', `启用 ${req.params.name} 开机自启失败`, e);
    res.status(500).json({ error: e.message });
  }
});

// 禁用开机自启
router.post('/services/:name/disable', async (req, res) => {
  try {
    const result = await systemd.controlService(req.params.name, 'disable');
    logger.info('Systemd', `禁用 ${req.params.name} 开机自启`);
    res.json(result);
  } catch (e) {
    logger.error('Systemd', `禁用 ${req.params.name} 开机自启失败`, e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
