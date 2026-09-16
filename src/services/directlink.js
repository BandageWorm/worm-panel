const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DIRECTLINK_DIR = path.join(DATA_DIR, 'directlink');
const FILES_DIR = path.join(DIRECTLINK_DIR, 'files');
const INDEX_PATH = path.join(DIRECTLINK_DIR, 'index.json');

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 10;

// 确保目录与 index.json 存在
function ensureDirs() {
  if (!fs.existsSync(DIRECTLINK_DIR)) fs.mkdirSync(DIRECTLINK_DIR, { recursive: true });
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) fs.writeFileSync(INDEX_PATH, JSON.stringify({}, null, 2), 'utf8');
}

// 读取整个 index（token -> meta 映射）
function readIndex() {
  ensureDirs();
  try {
    const raw = fs.readFileSync(INDEX_PATH, 'utf8');
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

// 写回整个 index
function writeIndex(index) {
  ensureDirs();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
}

// 生成不可猜测的 URL-safe token，写入前查重防碰撞
function generateToken() {
  const index = readIndex();
  let token;
  do {
    const bytes = crypto.randomBytes(TOKEN_LENGTH);
    token = '';
    for (let i = 0; i < TOKEN_LENGTH; i++) {
      token += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
    }
  } while (index[token]);
  return token;
}

// 实际存储文件路径（物理文件名 = token）
function filePath(token) {
  return path.join(FILES_DIR, token);
}

// 计算文件内容的 MD5（流式，避免大文件占用内存）
function computeMd5(fp) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(fp);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// 新增一条直链记录
// meta: { originalName, size, mime, createdAt, expiresAt, md5 }
function add(token, meta) {
  const index = readIndex();
  index[token] = {
    originalName: meta.originalName,
    size: meta.size,
    mime: meta.mime || 'application/octet-stream',
    md5: meta.md5 || null,
    createdAt: meta.createdAt || new Date().toISOString(),
    expiresAt: meta.expiresAt || null
  };
  writeIndex(index);
  return index[token];
}

// 列出所有直链记录（附带 token）
function list() {
  const index = readIndex();
  return Object.keys(index).map(token => ({ token, ...index[token] }));
}

// 获取单条记录
function get(token) {
  const index = readIndex();
  return index[token] || null;
}

// 删除直链：移除物理文件与元信息记录
function remove(token) {
  const index = readIndex();
  if (!index[token]) return false;
  const fp = filePath(token);
  if (fs.existsSync(fp)) {
    try { fs.unlinkSync(fp); } catch { /* 忽略删除失败，仍移除记录 */ }
  }
  delete index[token];
  writeIndex(index);
  return true;
}

// 过期判断：expiresAt 为 null 视为永久
function isExpired(meta) {
  if (!meta || !meta.expiresAt) return false;
  return new Date(meta.expiresAt).getTime() <= Date.now();
}

module.exports = {
  DIRECTLINK_DIR,
  FILES_DIR,
  ensureDirs,
  generateToken,
  filePath,
  computeMd5,
  add,
  list,
  get,
  remove,
  isExpired
};
