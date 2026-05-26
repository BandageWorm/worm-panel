const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const NOTES_DIR = path.join(DATA_DIR, 'notes');
const DRIVE_DIR = path.join(DATA_DIR, 'drive');
const HISTORY_PATH = path.join(DATA_DIR, 'sync-history.json');
const REMOTE_ROOT = 'syncremote:worm-panel-backup';
const MAX_HISTORY = 20;

let syncInProgress = false;

function getCfg() {
  return config.load();
}

function saveCfg(updates) {
  const cfg = getCfg();
  cfg.sync = { ...(cfg.sync || {}), ...updates };
  config.save(cfg);
}

// ── History storage (separate file) ──

function historyPath() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  return HISTORY_PATH;
}

function readHistory() {
  const hPath = historyPath();
  if (fs.existsSync(hPath)) {
    try {
      return JSON.parse(fs.readFileSync(hPath, 'utf8'));
    } catch { /* fall through */ }
  }
  // Migrate from config.json
  const cfg = getCfg();
  const oldHistory = (cfg.sync && cfg.sync.history) || [];
  if (oldHistory.length > 0) {
    fs.writeFileSync(hPath, JSON.stringify(oldHistory, null, 2), 'utf8');
    const s = cfg.sync || {};
    delete s.history;
    config.save(cfg);
  }
  return oldHistory;
}

function writeHistory(history) {
  const hPath = historyPath();
  fs.writeFileSync(hPath, JSON.stringify(history, null, 2), 'utf8');
}

function addHistoryRecord(record) {
  const history = readHistory();
  history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  writeHistory(history);
  return history;
}

function buildRcloneEnv(cfg) {
  return {
    ...process.env,
    RCLONE_CONFIG_SYNCREMOTE_TYPE: 'webdav',
    RCLONE_CONFIG_SYNCREMOTE_URL: cfg.webdavUrl || '',
    RCLONE_CONFIG_SYNCREMOTE_VENDOR: 'other',
    RCLONE_CONFIG_SYNCREMOTE_USER: cfg.webdavUser || '',
    RCLONE_CONFIG_SYNCREMOTE_PASS: cfg.webdavPass || '',
    RCLONE_CONFIG: '/dev/null'
  };
}

// ── Install check ──

function checkInstall() {
  return new Promise((resolve) => {
    execFile('rclone', ['--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve({ installed: false, version: null });
      } else {
        resolve({ installed: true, version: (stdout.trim().split('\n')[0] || 'unknown') });
      }
    });
  });
}

/**
 * 验证 aliyundrive-webdav 是否已安装（校验 pip 包）
 */
function checkWebdavProxy() {
  return new Promise((resolve) => {
    execFile('aliyundrive-webdav', ['--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve({ installed: false });
      } else {
        resolve({ installed: true });
      }
    });
  });
}

// ── WebDAV 配置流程 ──

async function obscurePassword(plain) {
  return new Promise((resolve, reject) => {
    execFile('rclone', ['obscure', plain], { timeout: 5000 }, (err, stdout) => {
      if (err) reject(new Error('密码加密失败'));
      else resolve(stdout.trim());
    });
  });
}

function generateAuthUrl() {
  return {
    type: 'webdav',
    instruction: '连接前请确保已安装并启动 aliyundrive-webdav：',
    steps: [
      '1. 安装: pip install aliyundrive-webdav',
      '2. 扫码登录: aliyundrive-webdav qr login（手机阿里云盘 App 扫码）',
      '3. 启动服务: aliyundrive-webdav --port 8080 -U admin -W 你的密码',
      '4. 或用 systemd: 编辑 /etc/aliyundrive-webdav.conf → systemctl start aliyundrive-webdav'
    ],
    hint: '启动后在下面填入 WebDAV 连接信息即可',
    docsUrl: 'https://github.com/messense/aliyundrive-webdav'
  };
}

async function completeAuth(webdavConfig) {
  const { url, user, password } = webdavConfig;
  if (!url || !password) {
    throw new Error('WebDAV 地址和密码不能为空');
  }

  // 加密密码
  const obscured = await obscurePassword(password);

  const testCfg = {
    webdavUrl: url,
    webdavUser: user || '',
    webdavPass: obscured
  };

  // 验证连通性
  try {
    await webdavExec(['lsf', 'syncremote:'], testCfg);
  } catch (e) {
    throw new Error('WebDAV 连接失败: ' + e.message);
  }

  saveCfg({
    provider: 'webdav',
    webdavUrl: url,
    webdavUser: user || '',
    webdavPass: obscured,
    connectedAt: new Date().toISOString()
  });
  return { success: true };
}

function disconnect() {
  saveCfg({
    provider: undefined,
    webdavUrl: undefined,
    webdavUser: undefined,
    webdavPass: undefined,
    connectedAt: undefined,
    lastSync: undefined
  });
}

// ── rclone execution ──

function webdavExec(args, syncCfg) {
  return new Promise((resolve, reject) => {
    const env = buildRcloneEnv(syncCfg);
    const child = execFile('rclone', args, { env, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr ? stderr.trim().split('\n').pop() : (err.message || 'rclone 执行失败');
        reject(new Error(msg));
      } else {
        resolve(stdout.trim());
      }
    });
    if (child.stderr) {
      child.stderr.on('data', () => {}); // drain
    }
  });
}

// ── Backup ──

async function backup() {
  const cfg = getCfg();
  const sync = cfg.sync || {};
  if (!sync.webdavUrl) {
    throw new Error('未配置 WebDAV 连接');
  }
  if (syncInProgress) {
    throw new Error('正在同步中，请稍后');
  }

  syncInProgress = true;
  const startTime = new Date();
  let status = 'ok';
  let files = 0;
  let size = 0;
  let errMsg = null;

  try {
    const remotePath = 'syncremote:worm-panel-backup/notes';
    await webdavExec(['mkdir', remotePath], sync).catch(() => {});
    await webdavExec(['sync', NOTES_DIR, remotePath, '--progress', '--stats-one-line'], sync);
    const listing = await webdavExec(['lsf', '--format', 'sp', '--separator', '|', remotePath], sync);
    if (listing) {
      const lines = listing.split('\n').filter(Boolean);
      files = lines.length;
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 1) {
          size += parseInt(parts[0], 10) || 0;
        }
      }
    }
  } catch (e) {
    status = 'fail';
    errMsg = e.message;
    logger.error('Sync', '备份失败', e);
  } finally {
    syncInProgress = false;
  }

  const record = { time: startTime.toISOString(), status, files, size, error: errMsg };
  addHistoryRecord(record);
  const updatedCfg = getCfg();
  const s = updatedCfg.sync || {};
  updatedCfg.sync = { ...s, lastSync: startTime.toISOString(), lastStatus: status };
  config.save(updatedCfg);

  return record;
}

// ── Restore ──

async function restore() {
  const cfg = getCfg();
  const sync = cfg.sync || {};
  if (!sync.webdavUrl) throw new Error('未配置 WebDAV 连接');

  await webdavExec(['sync', 'syncremote:worm-panel-backup/notes', NOTES_DIR], sync);
  return { success: true };
}

// ── Status ──

async function getStatus() {
  const cfg = getCfg();
  const sync = cfg.sync || {};
  const installed = await checkInstall();
  const webdavInstalled = await checkWebdavProxy();

  const result = {
    installed: installed.installed,
    rcloneVersion: installed.version,
    webdavInstalled: webdavInstalled.installed,
    provider: sync.provider || null,
    connected: !!sync.webdavUrl,
    webdavUrl: sync.webdavUrl || null,
    lastSync: sync.lastSync || null,
    lastStatus: sync.lastStatus || null,
    connectedAt: sync.connectedAt || null
  };

  return result;
}

// ── History ──

function getHistory() {
  return readHistory().slice(0, MAX_HISTORY);
}

// ── Public trigger (called from notes module) ──

function triggerBackup() {
  const cfg = getCfg();
  const sync = cfg.sync || {};
  if (!sync.webdavUrl || syncInProgress) return;
  backup().catch(err => logger.warn('Sync', '自动备份失败: ' + err.message));
}

// ── Drive sync ──

let driveSyncInProgress = false;

async function syncDrive() {
  const cfg = getCfg();
  const syncCfg = cfg.sync || {};
  if (!syncCfg.webdavUrl) {
    logger.info('Drive', 'WebDAV 未连接，跳过同步');
    return { skipped: true };
  }
  if (driveSyncInProgress) {
    logger.info('Drive', '同步进行中，跳过');
    return { skipped: true };
  }

  // Count local files before syncing
  let files = 0, size = 0;
  try {
    const counts = countDirSync(DRIVE_DIR);
    files = counts.files;
    size = counts.size;
  } catch { /* ignore */ }

  driveSyncInProgress = true;
  const startTime = new Date();
  let status = 'ok';
  let errMsg = null;

  try {
    const remotePath = 'syncremote:worm-panel-backup/drive';
    await webdavExec(['mkdir', remotePath], syncCfg).catch(() => {});
    await webdavExec(['sync', DRIVE_DIR, remotePath, '--progress', '--stats-one-line'], syncCfg);
    logger.info('Drive', '备份盘同步完成');
  } catch (e) {
    status = 'fail';
    errMsg = e.message;
    logger.error('Drive', '同步失败', e);
  } finally {
    driveSyncInProgress = false;
  }

  // Record history
  const record = { time: startTime.toISOString(), status, files, size, error: errMsg, source: 'drive' };
  addHistoryRecord(record);
  const updatedCfg = getCfg();
  const s = updatedCfg.sync || {};
  updatedCfg.sync = { ...s, lastSync: startTime.toISOString(), lastStatus: status };
  config.save(updatedCfg);

  return { success: status === 'ok', files, size };
}

function countDirSync(dirPath) {
  let files = 0, size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = countDirSync(fullPath);
        files += sub.files;
        size += sub.size;
      } else {
        files++;
        size += fs.statSync(fullPath).size;
      }
    }
  } catch { /* ignore */ }
  return { files, size };
}

function isDriveSyncing() {
  return driveSyncInProgress;
}

module.exports = {
  checkInstall,
  generateAuthUrl,
  completeAuth,
  disconnect,
  backup,
  restore,
  getStatus,
  getHistory,
  triggerBackup,
  syncDrive,
  isDriveSyncing
};
