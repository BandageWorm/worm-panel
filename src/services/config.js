const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

// 可在「系统设置」调整的参数，缺失时不写回 config.json，只按默认值生效
const DEFAULT_SETTINGS = {
  dashboardRefresh: 5,   // 仪表盘刷新间隔（秒）
  syncInterval: 12,      // 云备份自动同步周期（小时），0 = 关闭
  editMaxSize: 1,        // 在线编辑文件大小上限（MB）
  uploadMaxSize: 500     // 上传 / 直链单文件大小上限（MB）
};

const DEFAULT_CONFIG = {
  version: 1,
  initialized: false,
  port: 4567,
  mode: 'standalone',
  domain: null,
  passwordHash: '',
  setupToken: null,
  settings: { ...DEFAULT_SETTINGS },
};

function ensureDataDir() {
  const dirs = [DATA_DIR, path.join(DATA_DIR, 'notes'), path.join(DATA_DIR, 'backups'), path.join(DATA_DIR, 'logs'), path.join(DATA_DIR, 'drive'), path.join(DATA_DIR, 'cron-history')];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    save(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function save(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

// 合并默认值，避免老配置里只写了部分字段时读到 undefined
function getSettings(cfg) {
  const current = cfg || load();
  return { ...DEFAULT_SETTINGS, ...(current.settings || {}) };
}

module.exports = { load, save, getSettings, DEFAULT_CONFIG, DEFAULT_SETTINGS };
