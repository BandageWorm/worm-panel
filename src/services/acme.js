const fs = require('fs');
const path = require('path');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const nginx = require('./nginx');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const HOME_DIR = process.env.HOME || '/root';
const ACME_HOME = path.join(HOME_DIR, '.acme.sh');
const ACME_BIN = path.join(ACME_HOME, 'acme.sh');

// 域名校验：防止命令注入
function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    throw new Error('域名不能为空');
  }
  // 合法域名字符：字母、数字、-、.、* (通配符)
  if (!/^[a-zA-Z0-9.*\-]+$/.test(domain)) {
    throw new Error('域名格式不合法');
  }
}

async function acmeExec(args) {
  if (!fs.existsSync(ACME_BIN)) {
    throw new Error('acme.sh 未安装');
  }
  try {
    const { stdout } = await execFileAsync(ACME_BIN, args, {
      encoding: 'utf8',
      timeout: 120000
    });
    return stdout;
  } catch (e) {
    const output = e.stdout || e.stderr || e.message || '';
    throw new Error(output.trim());
  }
}

function checkInstalled() {
  return fs.existsSync(ACME_BIN);
}

async function install() {
  if (checkInstalled()) {
    return { success: true, message: 'acme.sh 已安装' };
  }
  try {
    await execAsync('curl -fsSL https://get.acme.sh | sh', {
      encoding: 'utf8',
      timeout: 60000
    });
    return { success: true, message: 'acme.sh 安装成功' };
  } catch (e) {
    const output = e.stdout || e.stderr || e.message || '';
    throw new Error('安装 acme.sh 失败: ' + output.trim());
  }
}

function listCerts() {
  if (!checkInstalled()) {
    return [];
  }

  const certsDir = path.join(ACME_HOME);
  if (!fs.existsSync(certsDir)) return [];

  const items = fs.readdirSync(certsDir);
  const certs = [];

  for (const item of items) {
    const itemPath = path.join(certsDir, item);
    if (!fs.statSync(itemPath).isDirectory()) continue;
    if (item.startsWith('.')) continue;

    const keyName = item.endsWith('_ecc') ? item.slice(0, -4) : item;
    const fullchainPath = path.join(itemPath, 'fullchain.cer');
    const keyPath = path.join(itemPath, `${keyName}.key`);
    const metaFile = path.join(itemPath, `${keyName}.conf`);

    if (!fs.existsSync(fullchainPath)) continue;

    let expireDate = null;
    let issuedDate = null;

    if (fs.existsSync(metaFile)) {
      const meta = fs.readFileSync(metaFile, 'utf8');
      const expireMatch = meta.match(/Le_NextRenewTimeStr\s*=\s*['"]?(.+?)['"]?\s*$/m);
      if (expireMatch) expireDate = expireMatch[1].trim();
      const issuedMatch = meta.match(/Le_IssueDate\s*=\s*['"]?(.+?)['"]?\s*$/m);
      if (issuedMatch) issuedDate = issuedMatch[1].trim();
    }

    // If no expire from meta, read cert directly (async not needed here, called rarely)
    if (!expireDate) {
      try {
        const { stdout } = require('child_process').spawnSync('openssl', [
          'x509', '-enddate', '-noout', '-in', fullchainPath
        ], { encoding: 'utf8' });
        const match = (stdout || '').match(/notAfter=(.+)/);
        if (match) expireDate = match[1].trim();
      } catch {}
    }

    certs.push({
      domain: keyName,
      expireDate,
      issuedDate,
      certPath: fullchainPath,
      keyPath
    });
  }

  return certs.sort((a, b) => a.domain.localeCompare(b.domain));
}

async function issueCert(domain) {
  validateDomain(domain);

  let useNginx = false;
  try {
    const sites = nginx.listSites();
    useNginx = sites.some(s => s.serverName === domain);
  } catch {}

  let args;
  if (useNginx) {
    args = ['--issue', '-d', domain, '--nginx', '--server', 'letsencrypt'];
  } else {
    args = [
      '--issue', '-d', domain, '--standalone', '--server', 'letsencrypt',
      '--pre-hook', 'systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null || true',
      '--post-hook', 'systemctl start nginx 2>/dev/null || service nginx start 2>/dev/null || true'
    ];
  }

  let out;
  try {
    out = await acmeExec(args);
  } catch (e) {
    // acme.sh 可能因各种警告退出非零码，但证书实际已签发
    const cert = getCertInfo(domain);
    if (cert) {
      return { success: true, message: '证书已存在: ' + (e.message || '').trim() };
    }
    throw e;
  }
  return { success: true, message: out.trim() };
}

async function renewCert(domain) {
  validateDomain(domain);

  let useNginx = false;
  try {
    const sites = nginx.listSites();
    useNginx = sites.some(s => s.serverName === domain);
  } catch {}

  let args;
  if (useNginx) {
    args = ['--renew', '-d', domain, '--nginx', '--server', 'letsencrypt'];
  } else {
    args = [
      '--renew', '-d', domain, '--standalone', '--server', 'letsencrypt',
      '--pre-hook', 'systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null || true',
      '--post-hook', 'systemctl start nginx 2>/dev/null || service nginx start 2>/dev/null || true'
    ];
  }

  let out;
  try {
    out = await acmeExec(args);
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('Skipping') || msg.includes('Next renewal time')) {
      return { success: true, message: '证书尚未到期，无需续期' };
    }
    throw e;
  }

  // Reload nginx after renewal
  try { await nginx.reload(); } catch {}
  return { success: true, message: '证书续期成功' };
}

async function renewAllCerts() {
  const out = await acmeExec(['--renew-all', '--server', 'letsencrypt']);
  try { await nginx.reload(); } catch {}
  return { success: true, message: out.trim() };
}

async function deleteCert(domain) {
  validateDomain(domain);

  const certsDir = path.join(ACME_HOME);
  const items = fs.readdirSync(certsDir).filter(item => {
    if (item.startsWith('.')) return false;
    const stat = fs.statSync(path.join(certsDir, item));
    if (!stat.isDirectory()) return false;
    return item === domain || item === `${domain}_ecc`;
  });

  if (items.length === 0) {
    throw new Error(`证书 ${domain} 未找到`);
  }

  // Remove via acme.sh first
  try {
    await acmeExec(['--remove', '-d', domain]);
  } catch (e) {
    // Continue even if acme.sh remove fails
  }

  // Clean up directories
  for (const item of items) {
    const itemPath = path.join(certsDir, item);
    fs.rmSync(itemPath, { recursive: true, force: true });
  }

  return { success: true, message: `证书 ${domain} 已删除` };
}

function getCertInfo(domain) {
  const certs = listCerts();
  return certs.find(c => c.domain === domain || c.domain === `${domain}_ecc`) || null;
}

async function applyToNginx(domain, targetPort) {
  validateDomain(domain);

  const sites = nginx.listSites();
  const site = sites.find(s => s.serverName === domain);

  // Verify cert exists
  const cert = getCertInfo(domain);
  if (!cert) {
    throw new Error(`域名 ${domain} 的证书不存在，请先申请`);
  }

  // Generate SSL nginx config
  const sslConfig = `server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate     ${cert.certPath};
    ssl_certificate_key ${cert.keyPath};

    location / {
        proxy_pass http://127.0.0.1:${targetPort};
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
    return 301 https://$host$request_uri;
}
`;

  const sitesPath = '/etc/nginx/sites-enabled';
  if (!fs.existsSync(sitesPath)) {
    fs.mkdirSync(sitesPath, { recursive: true });
  }

  const fileName = `${domain}.conf`;
  const filePath = path.join(sitesPath, fileName);

  fs.writeFileSync(filePath, sslConfig, 'utf8');

  // Validate and reload
  const validateResult = await nginx.validate();
  if (!validateResult.valid) {
    throw new Error('Nginx 配置校验失败: ' + validateResult.message);
  }

  await nginx.reload();
  return { fileName, message: `SSL 配置已应用到 ${domain}` };
}

module.exports = {
  checkInstalled, install, listCerts, issueCert, renewCert, renewAllCerts, deleteCert, getCertInfo, applyToNginx
};
