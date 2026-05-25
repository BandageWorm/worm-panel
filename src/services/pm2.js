const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

async function list() {
  await connect();
  const processes = await promisify(getClient().list)();
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
  await promisify(getClient().restart)(name);
  disconnect();
}

async function stop(name) {
  await connect();
  await promisify(getClient().stop)(name);
  disconnect();
}

async function reload(name) {
  await connect();
  await promisify(getClient().reload)(name);
  disconnect();
}

function getLogs(name, lines = 200) {
  const logDir = path.join(process.env.HOME || '/root', '.pm2', 'logs');
  const logFile = path.join(logDir, `${name}-out.log`);

  if (!fs.existsSync(logFile)) {
    // Try pm2 CLI fallback
    try {
      const out = execSync(`pm2 logs ${name} --lines ${lines} --nostream 2>&1`, {
        encoding: 'utf8',
        timeout: 5000
      });
      return out;
    } catch {
      throw new Error('日志文件不存在');
    }
  }

  const content = fs.readFileSync(logFile, 'utf8');
  const logLines = content.split('\n').filter(Boolean);
  return logLines.slice(-lines).join('\n');
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

module.exports = { list, restart, stop, reload, getLogs, getConfig, saveConfig };
