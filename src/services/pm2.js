const fs = require('fs');
const path = require('path');

const ECOSYSTEM_PATHS = [
  path.join(__dirname, '..', '..', 'ecosystem.config.js'),
  '/opt/worm-panel/ecosystem.config.js',
  process.cwd() + '/ecosystem.config.js'
];

let pm2Client = null;

function getClient() {
  if (!pm2Client) {
    pm2Client = require('pm2');
  }
  return pm2Client;
}

function promisify(fn) {
  return (...args) => new Promise((resolve, reject) => {
    fn(...args, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function connect() {
  const pm2 = getClient();
  return new Promise((resolve, reject) => {
    pm2.connect(err => {
      if (err && err.message && err.message.includes('already connected')) {
        return resolve();
      }
      if (err) reject(err);
      else resolve();
    });
  });
}

function disconnect() {
  if (pm2Client) {
    try { pm2Client.disconnect(); } catch {}
    pm2Client = null;
  }
}

function bindClient() {
  const c = getClient();
  return {
    list: promisify(c.list.bind(c)),
    restart: promisify(c.restart.bind(c)),
    stop: promisify(c.stop.bind(c)),
    reload: promisify(c.reload.bind(c)),
    delete: promisify(c.delete.bind(c)),
    start: promisify(c.start.bind(c))
  };
}

async function list() {
  await connect();
  const client = bindClient();
  const processes = await client.list();
  disconnect();
  return processes.map(p => ({
    name: p.name,
    pid: p.pid,
    status: p.pm2_env?.status || 'unknown',
    cpu: p.monit?.cpu || 0,
    memory: p.monit?.memory || 0,
    uptime: p.pm2_env?.pm_uptime ? Math.floor((Date.now() - p.pm2_env.pm_uptime) / 1000) : 0,
    restarts: p.pm2_env?.restart_time || 0,
    execMode: p.pm2_env?.exec_mode || 'fork',
    watch: p.pm2_env?.watch || false,
    version: p.pm2_env?.version || ''
  }));
}

async function restart(name) {
  await connect();
  const client = bindClient();
  await client.restart(name);
  disconnect();
}

async function stop(name) {
  await connect();
  const client = bindClient();
  await client.stop(name);
  disconnect();
}

async function reload(name) {
  await connect();
  const client = bindClient();
  await client.reload(name);
  disconnect();
}

async function start(name) {
  await connect();
  const client = bindClient();

  // 检查进程是否已在 PM2 列表中
  const processes = await client.list();
  const proc = processes.find(p => p.name === name);

  if (proc) {
    // 进程存在（可能是 stopped 状态），直接 restart
    await client.restart(name);
  } else {
    // 进程完全不在 PM2 中，尝试从 ecosystem 配置启动
    const configPath = getConfigPath();
    if (configPath && fs.existsSync(configPath)) {
      await client.start({
        script: configPath,
        args: ['--only', name]
      });
    } else {
      throw new Error(`进程 ${name} 不存在且未找到 ecosystem 配置`);
    }
  }

  disconnect();
}

async function removeProcess(name) {
  await connect();
  const client = bindClient();
  await client.delete(name);
  disconnect();
}

const LOG_DIRS = [
  path.join(process.env.HOME || '/root', '.pm2', 'logs'),
  '/opt/worm-panel/data/logs',
  '/root/worm-panel/data/logs'
];

function clearLogs(name) {
  let deleted = false;
  for (const logDir of LOG_DIRS) {
    for (const suffix of ['-out.log', '-error.log']) {
      const logFile = path.join(logDir, `${name}${suffix}`);
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
        deleted = true;
      }
    }
  }
  return deleted;
}

function getLogs(name, lines = 200) {
  for (const logDir of LOG_DIRS) {
    const logFile = path.join(logDir, `${name}-out.log`);
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      const logLines = content.split('\n').filter(Boolean);
      return logLines.slice(-lines).join('\n');
    }
  }

  throw new Error('日志文件不存在');
}

async function describe(name) {
  await connect();
  const client = bindClient();
  const processes = await client.list();
  disconnect();
  const proc = processes.find(p => p.name === name);
  if (!proc) throw new Error(`进程 ${name} 不存在`);
  return proc;
}

async function updateProcess(name, updates) {
  await connect();
  const client = bindClient();

  // Get current process to read existing props
  const processes = await client.list();
  const proc = processes.find(p => p.name === name);

  // Delete old process
  try { await client.delete(name); } catch {}

  // Build new start options
  const env = { ...(proc?.pm2_env?.env || {}) };
  if (updates.port) {
    env.PORT = String(updates.port);
  } else if (updates.port === '' || updates.port === null) {
    delete env.PORT;
  }

  const options = {
    script: updates.script || proc?.pm2_env?.pm_exec_path || name,
    name: updates.name || name,
    cwd: updates.cwd || proc?.pm2_env?.pm_cwd || process.cwd(),
    interpreter: updates.interpreter || proc?.pm2_env?.exec_interpreter || undefined,
    env,
    log_date_format: 'MM-DD HH:mm:ss'
  };
  if (updates.args) {
    options.args = typeof updates.args === 'string'
      ? updates.args.split(' ').filter(Boolean)
      : updates.args;
  }
  if (updates.name && updates.name !== name) {
    options.name = updates.name;
  }

  await client.start(options);
  disconnect();
  return options;
}

function getConfigPath() {
  for (const p of ECOSYSTEM_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return ECOSYSTEM_PATHS[0];
}

function getConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return '';
  return fs.readFileSync(configPath, 'utf8');
}

function saveConfig(content) {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, content, 'utf8');
  return configPath;
}

module.exports = { list, restart, stop, reload, start, describe, updateProcess, removeProcess, getLogs, clearLogs, getConfig, saveConfig };
