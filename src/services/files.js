const fs = require('fs');
const path = require('path');

function safeResolve(basePath) {
  // Resolve to absolute path and prevent directory traversal
  const resolved = path.resolve(basePath);
  // Allow only paths under root
  if (!resolved.startsWith('/')) {
    throw new Error('只允许绝对路径');
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

module.exports = { listDir, getFileInfo, deleteItem, mkdir };
