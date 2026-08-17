const { Router } = require('express');
const acme = require('../services/acme');
const nginx = require('../services/nginx');
const logger = require('../utils/logger');

const router = Router();

router.get('/status', (req, res) => {
  res.json({ installed: acme.checkInstalled() });
});

router.post('/install', async (req, res) => {
  try {
    const result = await acme.install();
    res.json(result);
  } catch (e) {
    logger.error('SSL', '安装 acme.sh 失败', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/certs', (req, res) => {
  const certs = acme.listCerts();
  res.json(certs);
});

router.post('/issue', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) {
      return res.status(400).json({ error: '域名不能为空' });
    }
    const result = await acme.issueCert(domain);
    res.json(result);
  } catch (e) {
    logger.error('SSL', `申请证书 ${req.body?.domain} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/renew/:domain', async (req, res) => {
  try {
    const result = await acme.renewCert(req.params.domain);
    res.json(result);
  } catch (e) {
    logger.error('SSL', `续期证书 ${req.params.domain} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/renew-all', async (req, res) => {
  try {
    const result = await acme.renewAllCerts();
    res.json(result);
  } catch (e) {
    logger.error('SSL', '全部续期失败', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/cert/:domain', async (req, res) => {
  try {
    const result = await acme.deleteCert(req.params.domain);
    res.json(result);
  } catch (e) {
    logger.error('SSL', `删除证书 ${req.params.domain} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/apply-to-nginx', async (req, res) => {
  try {
    const { domain, targetPort } = req.body;
    if (!domain) {
      return res.status(400).json({ error: '域名不能为空' });
    }
    const result = await acme.applyToNginx(domain, targetPort || 3000);
    res.json(result);
  } catch (e) {
    logger.error('SSL', `应用证书到 nginx 失败: ${req.body?.domain}`, e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
