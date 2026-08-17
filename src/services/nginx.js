const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');
const config = require('./config');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups', 'nginx');
const DEFAULT_SITE_DIR = path.join(DATA_DIR, 'default-site');
const MAX_BACKUPS = 30;

const SITES_ENABLED = '/etc/nginx/sites-enabled';

// 校验站点名/备份名，防止路径穿越
function validateSiteName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('名称不能为空');
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error('名称包含非法字符');
  }
  if (!/^[a-zA-Z0-9._\-]+$/.test(name)) {
    throw new Error('名称只允许字母、数字、-、_、.');
  }
}

// 异步执行 nginx 命令，自动 sudo 重试
async function nginxExec(args) {
  try {
    const { stdout } = await execFileAsync('nginx', args, {
      encoding: 'utf8',
      timeout: 10000
    });
    return stdout;
  } catch (e) {
    const output = (e.stderr || '') + (e.stdout || '');
    if (output.includes('Permission denied')) {
      const { stdout } = await execFileAsync('sudo', ['nginx', ...args], {
        encoding: 'utf8',
        timeout: 10000
      });
      return stdout;
    }
    throw e;
  }
}

function getSitesPath() {
  const cfg = config.load();
  return cfg.nginxSitesPath || SITES_ENABLED;
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

// ── Status ──

async function getStatus() {
  // Check if nginx process is running
  let running = false;
  try {
    const { stdout } = await execAsync('ps aux 2>/dev/null | grep -c "[n]ginx"', {
      encoding: 'utf8', timeout: 5000
    });
    running = parseInt(stdout.trim(), 10) > 0;
  } catch {
    running = false;
  }

  // Also validate config
  let configValid = false;
  let message = '';
  try {
    await nginxExec(['-t']);
    configValid = true;
    message = running ? '运行正常' : '进程未运行';
  } catch (e) {
    const errMsg = (e.stderr || e.stdout || '').trim();
    message = errMsg || 'nginx 配置有误';
    if (!running) {
      message = '进程未运行' + (errMsg ? ' — ' + errMsg : '');
    }
  }

  return { running, configValid, message };
}

// ── Sites ──

function listSites() {
  const sitesPath = getSitesPath();
  if (!fs.existsSync(sitesPath)) {
    fs.mkdirSync(sitesPath, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(sitesPath).filter(f => f.endsWith('.conf'));
  const sites = [];

  for (const file of files) {
    const filePath = path.join(sitesPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const stat = fs.statSync(filePath);

    const serverName = content.match(/server_name\s+([^;]+);/)?.[1]?.trim() || '';
    const listen = content.match(/listen\s+([^;]+);/)?.[1]?.trim() || '';
    const proxyPass = content.match(/proxy_pass\s+([^;]+);/)?.[1]?.trim() || '';

    sites.push({
      name: file,
      serverName,
      listen,
      proxyPass,
      isSelfManaged: file === 'panel.conf' || file === 'default.conf',
      updatedAt: stat.mtime.toISOString()
    });
  }

  return sites.sort((a, b) => a.name.localeCompare(b.name));
}

function getSite(name) {
  validateSiteName(name);
  const sitesPath = getSitesPath();
  const filePath = path.join(sitesPath, name);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

async function createSite({ domain, targetPort, ssl, sslRedirect, certPath, keyPath }) {
  const sitesPath = getSitesPath();
  const fileName = domain.replace(/[^a-zA-Z0-9.-]/g, '') + '.conf';
  const filePath = path.join(sitesPath, fileName);

  let configText;
  if (ssl) {
    if (!certPath || !keyPath) {
      throw new Error('启用 SSL 但未提供证书路径，请先在 SSL 证书页面申请证书');
    }

    const httpBlock = sslRedirect === false ? `server {
    listen 80;
    server_name ${domain};
    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:${targetPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}` : `server {
    listen 80;
    server_name ${domain};
    return 301 https://$host$request_uri;
}`;

    configText = `server {
    listen 443 ssl;
    server_name ${domain};
    client_max_body_size 500M;

    ssl_certificate     ${certPath};
    ssl_certificate_key ${keyPath};

    location / {
        proxy_pass http://127.0.0.1:${targetPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

${httpBlock}
`;
  } else {
    configText = `server {
    listen 80;
    server_name ${domain};
    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:${targetPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
  }

  // Backup existing config if any
  ensureBackupDir();
  if (fs.existsSync(filePath)) {
    const backupName = `${fileName}.${formatTimestamp()}.bak`;
    fs.copyFileSync(filePath, path.join(BACKUP_DIR, backupName));
    cleanupOldBackups();
  }

  // Write and validate
  fs.writeFileSync(filePath, configText, 'utf8');
  try {
    await nginxExec(['-t']);
  } catch (e) {
    fs.unlinkSync(filePath);
    throw new Error((e.stderr || e.stdout || '').trim() || 'nginx 配置校验失败');
  }

  await reload();
  return { fileName, configText };
}

async function updateSite(name, content) {
  validateSiteName(name);
  if (name === 'panel.conf' || name === 'default.conf') {
    throw new Error('面板自身配置不可编辑');
  }

  const sitesPath = getSitesPath();
  const filePath = path.join(sitesPath, name);

  if (!fs.existsSync(filePath)) {
    throw new Error('站点配置不存在');
  }

  // Backup first
  ensureBackupDir();
  const backupName = `${name}.${formatTimestamp()}.bak`;
  fs.copyFileSync(filePath, path.join(BACKUP_DIR, backupName));
  cleanupOldBackups();

  // Save original content for rollback
  const originalContent = fs.readFileSync(filePath, 'utf8');

  // Write new content and validate
  fs.writeFileSync(filePath, content, 'utf8');
  try {
    await nginxExec(['-t']);
  } catch (e) {
    // Rollback to original content
    fs.writeFileSync(filePath, originalContent, 'utf8');
    throw new Error((e.stderr || '').trim() || 'nginx 配置校验失败');
  }

  await reload();
}

async function deleteSite(name) {
  validateSiteName(name);
  if (name === 'panel.conf' || name === 'default.conf') {
    throw new Error('面板自身配置不可删除');
  }

  const sitesPath = getSitesPath();
  const filePath = path.join(sitesPath, name);

  if (!fs.existsSync(filePath)) {
    throw new Error('站点配置不存在');
  }

  // Backup first
  ensureBackupDir();
  const backupName = `${name}.${formatTimestamp()}.bak`;
  fs.copyFileSync(filePath, path.join(BACKUP_DIR, backupName));
  cleanupOldBackups();

  fs.unlinkSync(filePath);
  await reload();
}

// ── Validate & Reload ──

async function validate() {
  try {
    const out = await nginxExec(['-t']);
    return { valid: true, message: (out || '').trim() || 'nginx: configuration file test is successful' };
  } catch (e) {
    return { valid: false, message: (e.stderr || e.stdout || '').trim() || 'nginx 配置校验失败' };
  }
}

async function reload() {
  try {
    await nginxExec(['-s', 'reload']);
    return { success: true, message: 'Nginx 已重载' };
  } catch (e) {
    const errMsg = (e.stderr || e.stdout || '').trim() || '重载失败';
    return { success: false, message: errMsg };
  }
}

// ── Self-Managed Config ──

function generateSelfConfig(domain, port) {
  return `server {
    listen 80;
    server_name ${domain};
    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
}

function writeSelfConfig() {
  const cfg = config.load();
  if (cfg.mode !== 'proxy' || !cfg.domain) {
    const selfPath = path.join(getSitesPath(), 'panel.conf');
    if (fs.existsSync(selfPath)) {
      fs.unlinkSync(selfPath);
    }
    return;
  }

  const sitesPath = getSitesPath();
  if (!fs.existsSync(sitesPath)) {
    fs.mkdirSync(sitesPath, { recursive: true });
  }

  const selfPath = path.join(sitesPath, 'panel.conf');
  const content = generateSelfConfig(cfg.domain, cfg.port);
  fs.writeFileSync(selfPath, content, 'utf8');
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404 Not Found</title>
<style>
body{font-family:sans-serif;background:#fff;color:#333;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.container{text-align:center;padding:40px 20px}
.code{font-size:72px;font-weight:700;color:#e74c3c;line-height:1.2}
.msg{font-size:16px;color:#666;margin-top:12px}
</style>
</head>
<body>
<div class="container">
<div class="code">404</div>
<div class="msg">Not Found</div>
</div>
</body>
</html>`;

function writeDefaultConfig() {
  const sitesPath = getSitesPath();
  if (!fs.existsSync(sitesPath)) {
    fs.mkdirSync(sitesPath, { recursive: true });
  }

  const legacyDefault = path.join(sitesPath, 'default');
  if (fs.existsSync(legacyDefault)) {
    try { fs.unlinkSync(legacyDefault); } catch {}
  }

  if (!fs.existsSync(DEFAULT_SITE_DIR)) {
    fs.mkdirSync(DEFAULT_SITE_DIR, { recursive: true });
  }
  const indexPath = path.join(DEFAULT_SITE_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, DEFAULT_HTML, 'utf8');
  }

  const defaultPath = path.join(sitesPath, 'default.conf');
  const content = `server {
    listen 80 default_server;
    server_name _;

    root ${DEFAULT_SITE_DIR};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
`;
  fs.writeFileSync(defaultPath, content, 'utf8');
}

// ── Backups ──

function listBackups() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.bak'));
  return files.map(f => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    return {
      name: f,
      size: stat.size,
      updatedAt: stat.mtime.toISOString()
    };
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getBackup(name) {
  validateSiteName(name);
  const filePath = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function cleanupOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.bak'))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length > MAX_BACKUPS) {
    for (const f of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, f.name));
    }
  }
}

// ── Helpers ──

function formatTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

module.exports = {
  getStatus, listSites, getSite, createSite, updateSite, deleteSite,
  validate, reload, writeSelfConfig, writeDefaultConfig,
  listBackups, getBackup
};
