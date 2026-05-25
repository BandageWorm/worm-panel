const { Router } = require('express');
const workers = require('../services/workers');
const logger = require('../utils/logger');

const router = Router();

router.get('/status', (req, res) => {
  res.json(workers.checkWrangler());
});

router.get('/projects', (req, res) => {
  res.json(workers.getProjects());
});

router.post('/projects', (req, res) => {
  try {
    const { name, repo, branch } = req.body;
    if (!name || !repo) {
      return res.status(400).json({ error: '项目名称和仓库地址不能为空' });
    }
    const project = workers.addProject({ name, repo, branch });
    res.json(project);
  } catch (e) {
    logger.error('Workers', `添加项目 ${req.body?.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/projects/:name', (req, res) => {
  try {
    workers.removeProject(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('Workers', `删除项目 ${req.params.name} 失败`, e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/deploy/:name', (req, res) => {
  try {
    const result = workers.deploy(req.params.name);
    res.json(result);
  } catch (e) {
    logger.error('Workers', `部署 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/deploy/:name/log', (req, res) => {
  const log = workers.getDeployLog(req.params.name);
  res.json({ log });
});

module.exports = router;
