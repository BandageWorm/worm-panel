const { Router } = require('express');
const nginx = require('../services/nginx');
const acme = require('../services/acme');
const logger = require('../utils/logger');

const router = Router();

router.get('/status', async (req, res) => {
  try {
    const status = await nginx.getStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/sites', (req, res) => {
  const sites = nginx.listSites();
  res.json(sites);
});

router.get('/sites/:name', (req, res) => {
  try {
    const content = nginx.getSite(req.params.name);
    if (content === null) {
      return res.status(404).json({ error: '站点配置不存在' });
    }
    res.json({ name: req.params.name, content });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/sites', async (req, res) => {
  try {
    const { domain, targetPort, ssl, sslRedirect } = req.body;
    if (!domain || !targetPort) {
      return res.status(400).json({ error: '域名和目标端口不能为空' });
    }

    let certPath, keyPath;
    if (ssl) {
      const certInfo = acme.getCertInfo(domain);
      if (!certInfo) {
        return res.status(400).json({ error: `域名 ${domain} 的证书不存在，请先在 SSL 证书页面申请` });
      }
      certPath = certInfo.certPath;
      keyPath = certInfo.keyPath;
    }

    const result = await nginx.createSite({ domain, targetPort, ssl, sslRedirect, certPath, keyPath });
    const status = await nginx.getStatus();
    res.json({ success: true, ...result, nginxStatus: status });
  } catch (err) {
    logger.error('Nginx', `创建站点失败: ${err.message}`, err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/sites/:name', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: '配置内容不能为空' });
    }
    await nginx.updateSite(req.params.name, content);
    res.json({ success: true });
  } catch (err) {
    logger.error('Nginx', `更新站点 ${req.params.name} 失败: ${err.message}`, err);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/sites/:name', async (req, res) => {
  try {
    await nginx.deleteSite(req.params.name);
    res.json({ success: true });
  } catch (err) {
    logger.error('Nginx', `删除站点 ${req.params.name} 失败: ${err.message}`, err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/reload', async (req, res) => {
  const result = await nginx.reload();
  if (!result.success) {
    logger.error('Nginx', `重载失败: ${result.message}`);
  }
  res.json(result);
});

router.post('/validate', async (req, res) => {
  const result = await nginx.validate();
  if (!result.valid) {
    logger.error('Nginx', `配置校验失败: ${result.message}`);
  }
  res.json(result);
});

router.get('/backups', (req, res) => {
  const backups = nginx.listBackups();
  res.json(backups);
});

router.get('/backups/:name', (req, res) => {
  try {
    const content = nginx.getBackup(req.params.name);
    if (content === null) {
      return res.status(404).json({ error: '备份不存在' });
    }
    res.json({ name: req.params.name, content });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
