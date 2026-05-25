const fs = require('fs');
const path = require('path');

const NOTES_DIR = path.join(__dirname, '..', '..', 'data', 'notes');

function ensureDir() {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
  }
}

function sanitizeName(name) {
  // Remove path traversal chars, ensure .md extension
  let safe = name.replace(/\.\.\/|\.\.\\|\/|\\/g, '');
  if (!safe.endsWith('.md')) safe += '.md';
  return safe;
}

function resolvePath(name) {
  const safe = sanitizeName(name);
  const filePath = path.resolve(NOTES_DIR, safe);
  // Double-check we're still inside NOTES_DIR
  if (!filePath.startsWith(path.resolve(NOTES_DIR))) {
    throw new Error('非法的文件名');
  }
  return filePath;
}

function list() {
  ensureDir();
  const files = fs.readdirSync(NOTES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const stat = fs.statSync(path.join(NOTES_DIR, f));
      return { name: f, updatedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return files;
}

function get(name) {
  const filePath = resolvePath(name);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function create({ name, content }) {
  ensureDir();
  const filePath = resolvePath(name);
  if (fs.existsSync(filePath)) {
    throw new Error('笔记已存在');
  }
  fs.writeFileSync(filePath, content || '', 'utf8');
  return { name: path.basename(filePath) };
}

function update(name, content) {
  const filePath = resolvePath(name);
  if (!fs.existsSync(filePath)) {
    throw new Error('笔记不存在');
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return { name: path.basename(filePath) };
}

function del(name) {
  const filePath = resolvePath(name);
  if (!fs.existsSync(filePath)) {
    throw new Error('笔记不存在');
  }
  fs.unlinkSync(filePath);
}

module.exports = { list, get, create, update, del };
