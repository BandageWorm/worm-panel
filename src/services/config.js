const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

const DEFAULT_CONFIG = {
  version: 1,
  initialized: false,
  port: 4567,
  mode: 'standalone',
  domain: null,
  passwordHash: '',
  setupToken: null
};

function ensureDataDir() {
  const dirs = [DATA_DIR, path.join(DATA_DIR, 'notes'), path.join(DATA_DIR, 'backups'), path.join(DATA_DIR, 'logs'), path.join(DATA_DIR, 'drive')];
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

module.exports = { load, save, DEFAULT_CONFIG };
