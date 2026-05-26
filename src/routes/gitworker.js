const { Router } = require('express');
const gitworker = require('../services/gitworker');
const logger = require('../utils/logger');

const router = Router();

router.post('/deploy', async (req, res) => {
  try {
    const { repo, name, entry, branch, port } = req.body;
    if (!repo || !name) {
      return res.status(400).json({ error: '仓库地址和项目名称不能为空' });
    }
    const project = await gitworker.deploy({ repo, name, entry, branch, port });
    res.json({ success: true, project });
  } catch (e) {
    logger.error('GitWorker', '部署失败', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/deploy-generic', async (req, res) => {
  try {
    const { repo, name, branch, command, port } = req.body;
    if (!repo || !name) {
      return res.status(400).json({ error: '仓库地址和项目名称不能为空' });
    }
    const project = await gitworker.deployGeneric({ repo, name, branch, command, port });
    res.json({ success: true, project });
  } catch (e) {
    logger.error('GitWorker', '部署常规项目失败', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/projects', (req, res) => {
  try {
    res.json(gitworker.getProjects());
  } catch (e) {
    logger.error('GitWorker', '获取项目列表失败', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/projects/:name', async (req, res) => {
  try {
    await gitworker.removeProject(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('GitWorker', `删除项目 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
