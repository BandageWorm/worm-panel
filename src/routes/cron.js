const { Router } = require('express');
const cron = require('../services/cron');
const logger = require('../utils/logger');

const router = Router();

// 获取任务列表
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await cron.listJobs();
    res.json(jobs);
  } catch (e) {
    logger.error('Cron', '获取任务列表失败', e);
    res.status(500).json({ error: e.message });
  }
});

// 创建任务
router.post('/jobs', async (req, res) => {
  try {
    const { name, schedule, command } = req.body;
    const job = await cron.createJob({ name, schedule, command });
    res.json(job);
  } catch (e) {
    logger.error('Cron', '创建任务失败', e);
    const status = e.message.includes('已存在') ? 400 : 500;
    res.status(status).json({ error: e.message });
  }
});

// 编辑任务
router.put('/jobs/:id', async (req, res) => {
  try {
    const { name, schedule, command, enabled } = req.body;
    const result = await cron.updateJob(req.params.id, { name, schedule, command, enabled });
    res.json(result);
  } catch (e) {
    logger.error('Cron', `编辑任务 ${req.params.id} 失败`, e);
    const status = e.message.includes('不存在') ? 404 : 400;
    res.status(status).json({ error: e.message });
  }
});

// 删除任务
router.delete('/jobs/:id', async (req, res) => {
  try {
    const result = await cron.deleteJob(req.params.id);
    res.json(result);
  } catch (e) {
    logger.error('Cron', `删除任务 ${req.params.id} 失败`, e);
    const status = e.message.includes('不存在') ? 404 : 500;
    res.status(status).json({ error: e.message });
  }
});

// 立即执行任务
router.post('/jobs/:id/run', async (req, res) => {
  try {
    const result = await cron.runJob(req.params.id);
    res.json(result);
  } catch (e) {
    logger.error('Cron', `执行任务 ${req.params.id} 失败`, e);
    const status = e.message.includes('不存在') ? 404 : 500;
    res.status(status).json({ error: e.message });
  }
});

// 获取执行历史
router.get('/jobs/:id/history', (req, res) => {
  try {
    const history = cron.getHistory(req.params.id);
    res.json(history);
  } catch (e) {
    logger.error('Cron', `获取历史 ${req.params.id} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
