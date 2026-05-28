const fs = require('fs');
const path = require('path');

const BLOCKED_PREFIXES = ['/proc', '/sys', '/dev'];

function safeResolve(basePath) {
  // Resolve to absolute path and prevent directory traversal
  const resolved = path.resolve(basePath);
  // Allow only paths under root
  if (!resolved.startsWith('/')) {
    throw new Error('只允许绝对路径');
  }
  // Block sensitive system paths
  for (const prefix of BLOCKED_PREFIXES) {
    if (resolved === prefix || resolved.startsWith(prefix + '/')) {
      throw new Error('禁止访问系统敏感路径');
    }
  }
  return resolved;
}

function listDir(dirPath) {
  const resolved = safeResolve(dirPath);

  if (!fs.existsSync(resolved)) {
    throw new Error('路径不存在');
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error('不是目录');
  }

  const items = fs.readdirSync(resolved);
  const result = [];

  for (const name of items) {
    const fullPath = path.join(resolved, name);
    try {
      const s = fs.statSync(fullPath);
      result.push({
        name,
        type: s.isDirectory() ? 'dir' : 'file',
        size: s.size,
        mode: s.mode.toString(8).slice(-3),
        modifiedAt: s.mtime.toISOString()
      });
    } catch {
      // Skip files that can't be read
    }
  }

  // Sort: directories first, then by name
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

function getFileInfo(filePath) {
  const resolved = safeResolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error('文件不存在');
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    throw new Error('不支持下载目录');
  }

  return { path: resolved, name: path.basename(resolved), size: stat.size };
}

function deleteItem(itemPath) {
  const resolved = safeResolve(itemPath);

  if (!fs.existsSync(resolved)) {
    throw new Error('路径不存在');
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const items = fs.readdirSync(resolved);
    if (items.length > 0) {
      throw new Error('目录不为空，无法删除');
    }
    fs.rmdirSync(resolved);
  } else {
    fs.unlinkSync(resolved);
  }

  return { success: true };
}

function mkdir(dirPath) {
  const resolved = safeResolve(dirPath);

  if (fs.existsSync(resolved)) {
    throw new Error('路径已存在');
  }

  fs.mkdirSync(resolved, { recursive: false });
  return { success: true };
}

function readFile(filePath) {
  const resolved = safeResolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error('文件不存在');
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    throw new Error('无法读取目录');
  }

  if (stat.size > 1024 * 1024) {
    throw new Error('文件过大无法编辑（超过 1MB）');
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  return { content };
}

function writeFile(filePath, content) {
  const resolved = safeResolve(filePath);
  const parentDir = path.dirname(resolved);

  if (!fs.existsSync(parentDir)) {
    throw new Error('父目录不存在');
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    throw new Error('无法写入目录');
  }

  fs.writeFileSync(resolved, content, 'utf-8');
  return { success: true };
}

module.exports = { listDir, getFileInfo, deleteItem, mkdir, readFile, writeFile };
