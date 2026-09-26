const { Router } = require('express');
const pm2 = require('../services/pm2');
const gitworker = require('../services/gitworker');
const logger = require('../utils/logger');

const router = Router();

router.get('/processes', async (req, res) => {
  try {
    const processes = await pm2.list();
    res.json(processes);
  } catch (e) {
    logger.error('PM2', '获取进程列表失败', e);
    res.status(500).json({ error: 'PM2 连接失败: ' + e.message });
  }
});

router.post('/restart/:name', async (req, res) => {
  try {
    await pm2.restart(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `重启 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/start/:name', async (req, res) => {
  try {
    await pm2.start(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `启动 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/stop/:name', async (req, res) => {
  try {
    await pm2.stop(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `停止 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/reload/:name', async (req, res) => {
  try {
    await pm2.reload(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `重载 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/logs/:name', (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 200;
    const logs = pm2.getLogs(req.params.name, lines);
    res.json({ logs });
  } catch (e) {
    logger.error('PM2', `获取日志 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/logs/:name', (req, res) => {
  try {
    pm2.clearLogs(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `删除日志 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/processes/:name', async (req, res) => {
  try {
    const proc = await pm2.describe(req.params.name);
    res.json({
      name: proc.name,
      pid: proc.pid,
      script: proc.pm2_env?.pm_exec_path || '',
      args: proc.pm2_env?.args ? (Array.isArray(proc.pm2_env.args) ? proc.pm2_env.args.join(' ') : String(proc.pm2_env.args)) : '',
      cwd: proc.pm2_env?.pm_cwd || '',
      interpreter: proc.pm2_env?.exec_interpreter || '',
      port: proc.pm2_env?.env?.PORT || '',
      status: proc.pm2_env?.status || '',
      restarts: proc.pm2_env?.restart_time || 0
    });
  } catch (e) {
    logger.error('PM2', `获取进程详情 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/processes/:name', async (req, res) => {
  try {
    const { script, args, cwd, interpreter, port, name: newName } = req.body;
    await pm2.updateProcess(req.params.name, {
      script, args, cwd, interpreter, port, name: newName
    });
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `更新进程 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/processes/:name', async (req, res) => {
  try {
    // 同时清理 PM2 进程、workers.json 记录和代码目录
    await gitworker.removeProject(req.params.name);
    res.json({ success: true });
  } catch (e) {
    logger.error('PM2', `删除进程 ${req.params.name} 失败`, e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/config', (req, res) => {
  try {
    const content = pm2.getConfig();
    res.json({ content });
  } catch (e) {
    logger.error('PM2', '获取配置失败', e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/config', async (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined) {
      return res.status(400).json({ error: '配置内容不能为空' });
    }
    const configPath = pm2.saveConfig(content);

    // 保存后自动 reload 所有 PM2 进程；无进程时为空操作
    let reloaded = [];
    let reloadError = null;
    try {
      reloaded = await pm2.reloadAll();
    } catch (e) {
      reloadError = e.message;
      logger.warn('PM2', `配置已保存，但自动 reload 失败: ${e.message}`);
    }

    res.json({ success: true, configPath, reloaded, reloadError });
  } catch (e) {
    logger.error('PM2', '保存配置失败', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
