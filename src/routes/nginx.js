const { Router } = require('express');
const nginx = require('../services/nginx');
const logger = require('../utils/logger');

const router = Router();

router.get('/status', (req, res) => {
  res.json(nginx.getStatus());
});

router.get('/sites', (req, res) => {
  const sites = nginx.listSites();
  res.json(sites);
});

router.get('/sites/:name', (req, res) => {
  const content = nginx.getSite(req.params.name);
  if (content === null) {
    return res.status(404).json({ error: '站点配置不存在' });
  }
  res.json({ name: req.params.name, content });
});

router.post('/sites', (req, res) => {
  try {
    const { domain, targetPort, ssl } = req.body;
    if (!domain || !targetPort) {
      return res.status(400).json({ error: '域名和目标端口不能为空' });
    }
    const result = nginx.createSite({ domain, targetPort, ssl });
    const status = nginx.getStatus();
    res.json({ success: true, ...result, nginxStatus: status });
  } catch (err) {
    logger.error('Nginx', `创建站点失败: ${err.message}`, err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/sites/:name', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: '配置内容不能为空' });
    }
    nginx.updateSite(req.params.name, content);
    res.json({ success: true });
  } catch (err) {
    logger.error('Nginx', `更新站点 ${req.params.name} 失败: ${err.message}`, err);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/sites/:name', (req, res) => {
  try {
    nginx.deleteSite(req.params.name);
    res.json({ success: true });
  } catch (err) {
    logger.error('Nginx', `删除站点 ${req.params.name} 失败: ${err.message}`, err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/reload', (req, res) => {
  const result = nginx.reload();
  res.json(result);
});

router.post('/validate', (req, res) => {
  const result = nginx.validate();
  res.json(result);
});

router.get('/backups', (req, res) => {
  const backups = nginx.listBackups();
  res.json(backups);
});

router.get('/backups/:name', (req, res) => {
  const content = nginx.getBackup(req.params.name);
  if (content === null) {
    return res.status(404).json({ error: '备份不存在' });
  }
  res.json({ name: req.params.name, content });
});

module.exports = router;
