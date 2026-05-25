const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');

const XUI_PATHS = ['/opt/3x-ui/', '/usr/local/x-ui/'];
const XUI_SERVICE = 'x-ui';

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    return e.stdout || e.stderr || '';
  }
}

function detectInstallPath() {
  for (const p of XUI_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getServiceStatus() {
  const out = exec(`systemctl is-active ${XUI_SERVICE} 2>&1`);
  return out.trim() === 'active';
}

function getVersion(installPath) {
  if (!installPath) return null;
  // Try bin/x-ui or x-ui binary
  const binPaths = [
    path.join(installPath, 'bin', 'x-ui'),
    path.join(installPath, 'x-ui')
  ];
  for (const bin of binPaths) {
    if (fs.existsSync(bin)) {
      try {
        const out = execSync(`${bin} version 2>&1`, { encoding: 'utf8', timeout: 5000 });
        const m = out.match(/(\d+\.\d+(\.\d+)?)/);
        if (m) return m[1];
      } catch {}
    }
  }
  return null;
}

function detectPort() {
  // Check common 3X-UI ports by looking at listening services
  const out = exec('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null');
  // Common 3X-UI ports: 2053, 443, 80 + user-configured
  const commonPorts = [2053, 443, 8443, 9090, 10086];
  for (const port of commonPorts) {
    if (out.includes(`:${port}`) || out.includes(`0.0.0.0:${port}`)) {
      return port;
    }
  }
  return 2053; // default
}

function getStatus() {
  const installPath = detectInstallPath();
  const running = installPath ? getServiceStatus() : false;
  const version = getVersion(installPath);

  // Get memory/CPU info for the x-ui process
  let memory = null;
  let cpu = null;
  let uptime = null;
  let port = 2053;

  if (running) {
    try {
      const psOut = execSync(`ps aux | grep x-ui | grep -v grep 2>&1`, {
        encoding: 'utf8', timeout: 5000
      });
      const lines = psOut.trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const parts = lines[0].split(/\s+/);
        cpu = parseFloat(parts[2]) || null;
        memory = parseFloat(parts[3]) || null;
      }
    } catch {}

    port = detectPort();

    try {
      const uptimeOut = execSync(`systemctl show x-ui -p ActiveEnterTimestamp --value 2>&1`, {
        encoding: 'utf8', timeout: 5000
      });
      if (uptimeOut.trim()) {
        const started = new Date(uptimeOut.trim());
        uptime = Math.floor((Date.now() - started) / 1000);
      }
    } catch {}
  }

  // Get proxy info from config
  const cfg = config.load();
  const proxyInfo = cfg.xui?.proxy || null;

  return {
    installed: !!installPath,
    running,
    version,
    port,
    memory,
    cpu,
    uptime,
    installPath,
    proxyUrl: proxyInfo?.url || null,
    proxyDomain: proxyInfo?.domain || null
  };
}

function setProxy(domain) {
  const status = getStatus();
  if (!status.installed) {
    throw new Error('3X-UI 未安装');
  }

  const cfg = config.load();
  if (!cfg.xui) cfg.xui = {};
  cfg.xui.proxy = { domain, url: `http://${domain}` };
  config.save(cfg);

  // Generate nginx config
  const nginxConfig = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${status.port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;

  const sitesPath = '/etc/nginx/sites-enabled';
  if (!fs.existsSync(sitesPath)) {
    fs.mkdirSync(sitesPath, { recursive: true });
  }

  fs.writeFileSync(path.join(sitesPath, 'xui.conf'), nginxConfig, 'utf8');

  // Reload nginx
  try {
    const nginx = require('./nginx');
    nginx.reload();
  } catch {}

  return { domain, url: `http://${domain}`, port: status.port };
}

function removeProxy() {
  const cfg = config.load();
  if (cfg.xui) cfg.xui.proxy = null;
  config.save(cfg);

  const sitesPath = '/etc/nginx/sites-enabled';
  const configPath = path.join(sitesPath, 'xui.conf');
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
    try {
      const nginx = require('./nginx');
      nginx.reload();
    } catch {}
  }

  return { success: true };
}

function getProxy() {
  const cfg = config.load();
  return cfg.xui?.proxy || null;
}

module.exports = { getStatus, setProxy, removeProxy, getProxy };
