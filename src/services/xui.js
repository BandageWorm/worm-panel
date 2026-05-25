const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const config = require('./config');
const acme = require('./acme');

const XUI_PATHS = ['/opt/3x-ui/', '/usr/local/x-ui/'];
const XUI_CONFIG_NAMES = ['config.json', 'x-ui.json'];
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

function detectConfig(installPath) {
  // 3X-UI stores web config in SQLite database
  const dbPath = '/etc/x-ui/x-ui.db';
  try {
    if (fs.existsSync(dbPath)) {
      const out = execSync(`sqlite3 "${dbPath}" "SELECT key, value FROM settings WHERE key IN ('webPort','webBasePath','webCertFile','webKeyFile')" 2>&1`, {
        encoding: 'utf8', timeout: 5000
      });
      const cfg = {};
      for (const line of out.trim().split('\n').filter(Boolean)) {
        const sep = line.indexOf('|');
        if (sep === -1) continue;
        const key = line.slice(0, sep).trim();
        const val = line.slice(sep + 1).trim();
        if (key === 'webPort') cfg.webPort = parseInt(val, 10);
        else if (key === 'webBasePath') cfg.webBasePath = val;
        else if (key === 'webCertFile') cfg.webCertFile = val;
        else if (key === 'webKeyFile') cfg.webKeyFile = val;
      }
      return {
        webPort: cfg.webPort || null,
        webPath: cfg.webBasePath || null,
        webCertFile: cfg.webCertFile || null,
        webKeyFile: cfg.webKeyFile || null
      };
    }
  } catch {}

  // Fallback: try JSON config files
  const searchPaths = [];
  if (installPath) {
    for (const name of XUI_CONFIG_NAMES) {
      searchPaths.push(path.join(installPath, name));
    }
  }
  searchPaths.push('/etc/x-ui/x-ui.json', '/etc/x-ui/config.json');

  for (const p of searchPaths) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const c = JSON.parse(raw);
      return {
        webPort: c.webPort || null,
        webPath: c.webPath || null,
        webCertFile: c.webCertFile || null,
        webKeyFile: c.webKeyFile || null
      };
    } catch {}
  }
  return null;
}

function getServerIP() {
  // Get the primary non-internal IPv4 address
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces).sort()) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

function getStatus() {
  const installPath = detectInstallPath();
  const running = installPath ? getServiceStatus() : false;
  const version = getVersion(installPath);

  // Get memory/CPU info for the x-ui process
  let memory = null;
  let cpu = null;
  let uptime = null;
  let port = null;
  let webPath = '/panel';
  let xuiConfig = null;

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

  // 不论运行状态，始终读取 3X-UI 配置（端口、webPath、证书）
  xuiConfig = detectConfig(installPath);
  if (xuiConfig) {
    if (xuiConfig.webPort) port = xuiConfig.webPort;
    if (xuiConfig.webPath) webPath = xuiConfig.webPath;
  }

  // Build direct access URL
  const serverIP = getServerIP();
  let directUrl = null;
  if (serverIP && port && webPath) {
    const path = webPath.startsWith('/') ? webPath : '/' + webPath;
    let useHttps = false;
    if (xuiConfig && xuiConfig.webCertFile && xuiConfig.webKeyFile) {
      useHttps = fs.existsSync(xuiConfig.webCertFile) && fs.existsSync(xuiConfig.webKeyFile);
    }
    directUrl = `${useHttps ? 'https' : 'http'}://${serverIP}:${port}${path}`;
  }

  // Get proxy info from config
  const cfg = config.load();
  const proxyInfo = cfg.xui?.proxy || null;

  return {
    installed: !!installPath,
    running,
    version,
    port,
    webPath,
    memory,
    cpu,
    uptime,
    installPath,
    directUrl,
    serverIP,
    proxyUrl: proxyInfo?.url || null,
    proxyDomain: proxyInfo?.domain || null
  };
}

function setProxy(domain) {
  const status = getStatus();
  if (!status.installed) {
    throw new Error('3X-UI 未安装');
  }

  // proxy_pass 不加 URI，nginx 透传原始请求路径给 3X-UI。
  // 3X-UI 前端使用绝对路径引用资源（如 /${webBasePath}/assets/...），
  // 浏览器请求这些路径时 nginx 直接转发，不会路径翻倍。
  if (!status.port) {
    throw new Error('无法读取 3X-UI 端口，请检查 3X-UI 是否正常运行');
  }
  const isHttps = status.directUrl?.startsWith('https://') || false;
  const protocol = isHttps ? 'https' : 'http';
  const backendUrl = `${protocol}://127.0.0.1:${status.port}`;
  const proxyUrl = `https://${domain}/`;

  // Auto-issue SSL cert
  let certPath, keyPath;
  let existingCert = acme.getCertInfo(domain);
  if (existingCert) {
    certPath = existingCert.certPath;
    keyPath = existingCert.keyPath;
  } else {
    try {
      acme.issueCert(domain);
      existingCert = acme.getCertInfo(domain);
      if (existingCert) {
        certPath = existingCert.certPath;
        keyPath = existingCert.keyPath;
      }
    } catch (e) {
      throw new Error(`SSL 证书申请失败: ${e.message}`);
    }
  }

  const cfg = config.load();
  if (!cfg.xui) cfg.xui = {};
  cfg.xui.proxy = { domain, url: proxyUrl };
  config.save(cfg);

  // Generate nginx config with SSL.
  // 根路径重定向到 3X-UI webPath，后续请求透传避免 asset 路径翻倍
  const webPath = status.webPath || '/';
  const nginxConfig = `server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate     ${certPath};
    ssl_certificate_key ${keyPath};

    location = / {
        return 301 ${webPath};
    }

    location / {
        proxy_pass ${backendUrl};
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name ${domain};
    return 301 https://\$host\$request_uri;
}
`;

  const sitesPath = '/etc/nginx/sites-enabled';
  if (!fs.existsSync(sitesPath)) {
    fs.mkdirSync(sitesPath, { recursive: true });
  }

  fs.writeFileSync(path.join(sitesPath, 'xui.conf'), nginxConfig, 'utf8');

  // Validate and reload nginx
  try {
    const nginx = require('./nginx');
    nginx.validate();
    nginx.reload();
  } catch {}

  return { domain, url: proxyUrl, port: status.port };
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
