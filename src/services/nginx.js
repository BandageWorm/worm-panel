const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups', 'nginx');
const MAX_BACKUPS = 30;

const SITES_ENABLED = '/etc/nginx/sites-enabled';

// Wrap nginx commands, auto-retry with sudo if needed (WSL2 non-root)
function nginxExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    const output = (e.stderr || '') + (e.stdout || '');
    if (e.status === 1 && output.includes('Permission denied')) {
      return execSync('sudo ' + cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
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

function getStatus() {
  try {
    nginxExec('nginx -t 2>&1');
    return { running: true, message: '配置正常' };
  } catch {
    try {
      const out = nginxExec('nginx -t 2>&1');
      return { running: false, message: out.trim() };
    } catch (e) {
      return { running: false, message: (e.stderr || e.stdout || '').trim() || 'nginx 未安装或无法运行' };
    }
  }
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
      isSelfManaged: file === 'panel.conf',
      updatedAt: stat.mtime.toISOString()
    });
  }

  return sites.sort((a, b) => a.name.localeCompare(b.name));
}

function getSite(name) {
  const sitesPath = getSitesPath();
  const filePath = path.join(sitesPath, name);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function createSite({ domain, targetPort, ssl }) {
  const sitesPath = getSitesPath();
  const fileName = domain.replace(/[^a-zA-Z0-9.-]/g, '') + '.conf';
  const filePath = path.join(sitesPath, fileName);

  // Use template with SSL if configured with cert, otherwise plain HTTP
  let configText;
  if (ssl) {
    configText = `server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate     /root/.acme.sh/${domain}/fullchain.cer;
    ssl_certificate_key /root/.acme.sh/${domain}/${domain}.key;

    location / {
        proxy_pass http://127.0.0.1:${targetPort};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name ${domain};
    return 301 https://$host$request_uri;
}
`;
  } else {
    configText = `server {
    listen 80;
    server_name ${domain};

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

  fs.writeFileSync(filePath, configText, 'utf8');
  return { fileName, configText };
}

function updateSite(name, content) {
  if (name === 'panel.conf') {
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

  // Validate before writing
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, content, 'utf8');
  try {
    nginxExec('nginx -t 2>&1');
  } catch (e) {
    fs.unlinkSync(tmpPath);
    throw new Error(e.stderr?.trim() || 'nginx 配置校验失败');
  }

  // Replace and reload
  fs.renameSync(tmpPath, filePath);
  reload();
}

function deleteSite(name) {
  if (name === 'panel.conf') {
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
  reload();
}

// ── Validate & Reload ──

function validate() {
  try {
    const out = nginxExec('nginx -t 2>&1');
    return { valid: true, message: out.trim() };
  } catch (e) {
    return { valid: false, message: (e.stderr || e.stdout || '').trim() || 'nginx 配置校验失败' };
  }
}

function reload() {
  try {
    nginxExec('nginx -s reload 2>&1');
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

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
}

function writeSelfConfig() {
  const cfg = config.load();
  if (cfg.mode !== 'proxy' || !cfg.domain) {
    // Remove panel.conf if exists but shouldn't
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
  validate, reload, writeSelfConfig,
  listBackups, getBackup
};
