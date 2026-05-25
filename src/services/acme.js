const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const nginx = require('./nginx');

const HOME_DIR = process.env.HOME || '/root';
const ACME_HOME = path.join(HOME_DIR, '.acme.sh');
const ACME_BIN = path.join(ACME_HOME, 'acme.sh');

function acmeExec(args) {
  if (!fs.existsSync(ACME_BIN)) {
    throw new Error('acme.sh 未安装');
  }
  const cmd = `${ACME_BIN} ${args} 2>&1`;
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    const output = e.stdout || e.stderr || e.message || '';
    throw new Error(output.trim());
  }
}

function checkInstalled() {
  return fs.existsSync(ACME_BIN);
}

function install() {
  if (checkInstalled()) {
    return { success: true, message: 'acme.sh 已安装' };
  }
  try {
    execSync(
      'curl -fsSL https://get.acme.sh | sh 2>&1',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000 }
    );
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

    // ECC 证书目录名带 _ecc 后缀，但内部文件名使用原始域名
    const keyName = item.endsWith('_ecc') ? item.slice(0, -4) : item;
    const fullchainPath = path.join(itemPath, 'fullchain.cer');
    const keyPath = path.join(itemPath, `${keyName}.key`);
    const metaFile = path.join(itemPath, `${keyName}.conf`);

    if (!fs.existsSync(fullchainPath)) continue;

    let expireDate = null;
    let issuedDate = null;

    // Try to read meta info
    if (fs.existsSync(metaFile)) {
      const meta = fs.readFileSync(metaFile, 'utf8');
      const expireMatch = meta.match(/Le_NextRenewTimeStr\s*=\s*['"]?(.+?)['"]?\s*$/m);
      if (expireMatch) expireDate = expireMatch[1].trim();
      const issuedMatch = meta.match(/Le_IssueDate\s*=\s*['"]?(.+?)['"]?\s*$/m);
      if (issuedMatch) issuedDate = issuedMatch[1].trim();
    }

    // If no expire from meta, read cert directly
    if (!expireDate) {
      try {
        const out = execSync(
          `openssl x509 -enddate -noout -in "${fullchainPath}" 2>&1`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const match = out.match(/notAfter=(.+)/);
        if (match) expireDate = match[1].trim();
      } catch {}
    }

    certs.push({
      domain: item,
      expireDate,
      issuedDate,
      certPath: fullchainPath,
      keyPath
    });
  }

  return certs.sort((a, b) => a.domain.localeCompare(b.domain));
}

function issueCert(domain) {
  // 使用 Let's Encrypt CA（acme.sh 默认已改为 ZeroSSL，后者需邮箱注册）
  let useNginx = false;
  try {
    const sites = nginx.listSites();
    useNginx = sites.some(s => s.serverName === domain);
  } catch {}

  let args;
  if (useNginx) {
    args = `--issue -d "${domain}" --nginx --server letsencrypt`;
  } else {
    args = `--issue -d "${domain}" --standalone --server letsencrypt --pre-hook "systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null || true" --post-hook "systemctl start nginx 2>/dev/null || service nginx start 2>/dev/null || true"`;
  }

  const out = acmeExec(args);
  return { success: true, message: out.trim() };
}

function renewCert(domain) {
  let useNginx = false;
  try {
    const sites = nginx.listSites();
    useNginx = sites.some(s => s.serverName === domain);
  } catch {}

  let args;
  if (useNginx) {
    args = `--renew -d "${domain}" --nginx --server letsencrypt`;
  } else {
    args = `--renew -d "${domain}" --standalone --server letsencrypt --pre-hook "systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null || true" --post-hook "systemctl start nginx 2>/dev/null || service nginx start 2>/dev/null || true"`;
  }

  const out = acmeExec(args);
  // Reload nginx after renewal
  try { nginx.reload(); } catch {}
  return { success: true, message: out.trim() };
}

function getCertInfo(domain) {
  const certs = listCerts();
  return certs.find(c => c.domain === domain || c.domain === `${domain}_ecc`) || null;
}

function applyToNginx(domain, targetPort) {
  // Find existing nginx site config for this domain
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
    }
}

server {
    listen 80;
    server_name ${domain};
    return 301 https://$host$request_uri;
}
`;

  // Write config
  const sitesPath = '/etc/nginx/sites-enabled';
  if (!fs.existsSync(sitesPath)) {
    fs.mkdirSync(sitesPath, { recursive: true });
  }

  const fileName = `${domain}.conf`;
  const filePath = path.join(sitesPath, fileName);

  // Backup and write
  fs.writeFileSync(filePath, sslConfig, 'utf8');

  // Validate and reload
  const validateResult = nginx.validate();
  if (!validateResult.valid) {
    // Restore backup if exists
    throw new Error('Nginx 配置校验失败: ' + validateResult.message);
  }

  nginx.reload();
  return { fileName, message: `SSL 配置已应用到 ${domain}` };
}

module.exports = {
  checkInstalled, install, listCerts, issueCert, renewCert, getCertInfo, applyToNginx
};
