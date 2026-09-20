const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

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

// 校验文件名：非空、不含路径分隔符与 ..
function validateName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('名称不能为空');
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('名称非法，不能包含路径分隔符或 ..');
  }
}

// 执行系统命令，遇权限不足自动 sudo 重试（参照 firewall.js 的 ufwExec）
async function sysExec(cmd, args, opts = {}) {
  const execOpts = { encoding: 'utf8', timeout: 60000, ...opts };
  try {
    const { stdout } = await execFileAsync(cmd, args, execOpts);
    return stdout;
  } catch (e) {
    const output = ((e.stderr || '') + (e.stdout || '')).trim();
    const permDenied = /permission denied|EACCES|Operation not permitted/i.test(output + ' ' + (e.message || ''));
    if (permDenied) {
      try {
        const { stdout } = await execFileAsync('sudo', [cmd, ...args], execOpts);
        return stdout;
      } catch (e2) {
        const out2 = ((e2.stderr || '') + (e2.stdout || '')).trim();
        throw new Error(out2 || e2.message);
      }
    }
    throw new Error(output || e.message);
  }
}

// 检测命令是否存在
async function commandExists(cmd) {
  try {
    await execFileAsync('which', [cmd], { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
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

// 删除文件或目录；recursive=true 时允许删除非空目录
function deleteItem(itemPath, recursive = false) {
  const resolved = safeResolve(itemPath);

  if (!fs.existsSync(resolved)) {
    throw new Error('路径不存在');
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const items = fs.readdirSync(resolved);
    if (items.length > 0) {
      if (!recursive) {
        throw new Error('目录不为空，无法删除');
      }
      fs.rmSync(resolved, { recursive: true, force: false });
    } else {
      fs.rmdirSync(resolved);
    }
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

// 重命名文件或目录（同目录内改名）
function rename(itemPath, newName) {
  validateName(newName);
  const resolved = safeResolve(itemPath);

  if (!fs.existsSync(resolved)) {
    throw new Error('路径不存在');
  }

  const target = safeResolve(path.join(path.dirname(resolved), newName));
  if (fs.existsSync(target)) {
    throw new Error('目标名称已存在');
  }

  fs.renameSync(resolved, target);
  return { success: true, path: target };
}

// 计算目标最终路径。移动/复制的 dest 语义为「目标目录」：
// - dest 已存在且是目录 → 目标 = dest/basename(src)
// - dest 已存在且是文件 → 报错，不覆盖
// - dest 不存在 → 视为要移入的（新）目录，自动创建后目标 = dest/basename(src)
function resolveDest(srcResolved, dest) {
  const destDir = safeResolve(dest);
  if (fs.existsSync(destDir)) {
    if (!fs.statSync(destDir).isDirectory()) {
      throw new Error('目标已存在且不是目录');
    }
  } else {
    fs.mkdirSync(destDir, { recursive: true });
  }
  return safeResolve(path.join(destDir, path.basename(srcResolved)));
}

// 移动文件或目录（可跨目录）
function move(src, dest) {
  const srcResolved = safeResolve(src);
  if (!fs.existsSync(srcResolved)) {
    throw new Error('源路径不存在');
  }

  const destResolved = resolveDest(srcResolved, dest);
  const destParent = path.dirname(destResolved);
  if (!fs.existsSync(destParent)) {
    throw new Error('目标父目录不存在');
  }
  if (fs.existsSync(destResolved)) {
    throw new Error('目标已存在');
  }

  try {
    fs.renameSync(srcResolved, destResolved);
  } catch (e) {
    // 跨设备（EXDEV）时降级为复制 + 删除源
    if (e.code === 'EXDEV') {
      fs.cpSync(srcResolved, destResolved, { recursive: true, errorOnExist: true, force: false });
      fs.rmSync(srcResolved, { recursive: true, force: false });
    } else {
      throw e;
    }
  }
  return { success: true, path: destResolved };
}

// 为目标路径生成一个不冲突的名称：在扩展名前追加 _bak，再冲突则 _bak2、_bak3…
// 例：a.txt → a_bak.txt → a_bak2.txt；目录 d → d_bak → d_bak2
function dedupePath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;

  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  // 对含点的文件取最后一个扩展名；.tar.gz 这类多重后缀仅在最后一段前插入，可接受
  const isDir = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  let stem = base;
  let ext = '';
  if (!isDir) {
    // 优先识别常见复合扩展名，避免 archive.tar.gz 被拆成 archive.tar_bak.gz
    const COMPOUND = ['.tar.gz', '.tar.bz2', '.tar.xz', '.tar.zst'];
    const lower = base.toLowerCase();
    const compound = COMPOUND.find(s => lower.endsWith(s) && base.length > s.length);
    if (compound) {
      stem = base.slice(0, base.length - compound.length);
      ext = base.slice(base.length - compound.length);
    } else {
      const dotIdx = base.lastIndexOf('.');
      if (dotIdx > 0) { stem = base.slice(0, dotIdx); ext = base.slice(dotIdx); }
    }
  }

  let candidate = path.join(dir, `${stem}_bak${ext}`);
  let n = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem}_bak${n}${ext}`);
    n += 1;
  }
  return candidate;
}

// 复制文件或目录（目录递归）。目标已存在同名项时，自动追加 _bak 后缀生成副本
function copy(src, dest) {
  const srcResolved = safeResolve(src);
  if (!fs.existsSync(srcResolved)) {
    throw new Error('源路径不存在');
  }

  const destResolved = resolveDest(srcResolved, dest);
  const destParent = path.dirname(destResolved);
  if (!fs.existsSync(destParent)) {
    throw new Error('目标父目录不存在');
  }

  const finalDest = dedupePath(destResolved);
  fs.cpSync(srcResolved, finalDest, { recursive: true, errorOnExist: true, force: false });
  return { success: true, path: finalDest };
}

// 新建空文件（不覆盖已存在文件）
function newFile(filePath) {
  const resolved = safeResolve(filePath);
  const parentDir = path.dirname(resolved);

  if (!fs.existsSync(parentDir)) {
    throw new Error('父目录不存在');
  }
  if (fs.existsSync(resolved)) {
    throw new Error('文件已存在');
  }

  fs.writeFileSync(resolved, '', { flag: 'wx' });
  return { success: true, path: resolved };
}

// 修改权限（chmod）
async function chmod(itemPath, mode) {
  if (!/^[0-7]{3,4}$/.test(String(mode || ''))) {
    throw new Error('权限值非法，需为三位或四位八进制');
  }
  const resolved = safeResolve(itemPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('路径不存在');
  }

  await sysExec('chmod', [String(mode), resolved]);
  return { success: true };
}

// 解压压缩包
async function extract(archivePath, dest) {
  const resolved = safeResolve(archivePath);
  if (!fs.existsSync(resolved)) {
    throw new Error('压缩包不存在');
  }
  if (fs.statSync(resolved).isDirectory()) {
    throw new Error('不能解压目录');
  }

  const destDir = dest ? safeResolve(dest) : path.dirname(resolved);
  if (!fs.existsSync(destDir)) {
    throw new Error('目标目录不存在');
  }

  const lower = resolved.toLowerCase();
  let cmd, args, needCmd;
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    cmd = 'tar'; args = ['-xzf', resolved, '-C', destDir]; needCmd = 'tar';
  } else if (lower.endsWith('.tar')) {
    cmd = 'tar'; args = ['-xf', resolved, '-C', destDir]; needCmd = 'tar';
  } else if (lower.endsWith('.zip')) {
    cmd = 'unzip'; args = ['-o', resolved, '-d', destDir]; needCmd = 'unzip';
  } else {
    throw new Error('不支持的压缩格式（支持 .tar/.tar.gz/.tgz/.zip）');
  }

  if (!(await commandExists(needCmd))) {
    throw new Error(`缺少所需命令：${needCmd} 未安装`);
  }

  await sysExec(cmd, args);
  logger.info('Files', `解压 ${resolved} → ${destDir}`);
  return { success: true, dest: destDir };
}

// 压缩文件或目录
async function compress(itemPath, format, dest) {
  const resolved = safeResolve(itemPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('源路径不存在');
  }

  const parent = path.dirname(resolved);
  const base = path.basename(resolved);

  let cmd, args, outPath, needCmd;
  if (format === 'tar.gz') {
    outPath = dest ? safeResolve(dest) : safeResolve(path.join(parent, base + '.tar.gz'));
    cmd = 'tar'; args = ['-czf', outPath, '-C', parent, base]; needCmd = 'tar';
  } else if (format === 'zip') {
    outPath = dest ? safeResolve(dest) : safeResolve(path.join(parent, base + '.zip'));
    cmd = 'zip'; args = ['-r', outPath, base]; needCmd = 'zip';
  } else {
    throw new Error('不支持的压缩格式（支持 tar.gz/zip）');
  }

  if (fs.existsSync(outPath)) {
    throw new Error('目标压缩包已存在');
  }
  if (!(await commandExists(needCmd))) {
    throw new Error(`缺少所需命令：${needCmd} 未安装`);
  }

  // zip 需在源父目录下执行以保证包内相对路径正确
  await sysExec(cmd, args, format === 'zip' ? { cwd: parent } : {});
  logger.info('Files', `压缩 ${resolved} → ${outPath}`);
  return { success: true, path: outPath };
}

// 批量压缩：将多个（同一父目录下的）项打进同一个压缩包
async function batchCompress(paths, format, dest) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('paths 不能为空');
  }

  // 校验每一项存在，并收集父目录与名称
  let parent = null;
  const names = [];
  for (const p of paths) {
    const resolved = safeResolve(p);
    if (!fs.existsSync(resolved)) {
      throw new Error(`路径不存在：${p}`);
    }
    const dir = path.dirname(resolved);
    if (parent === null) {
      parent = dir;
    } else if (parent !== dir) {
      throw new Error('批量压缩要求所有项位于同一目录');
    }
    names.push(path.basename(resolved));
  }

  let cmd, args, outPath, needCmd;
  if (format === 'tar.gz') {
    outPath = dest ? safeResolve(dest) : safeResolve(path.join(parent, 'archive.tar.gz'));
    needCmd = 'tar';
  } else if (format === 'zip') {
    outPath = dest ? safeResolve(dest) : safeResolve(path.join(parent, 'archive.zip'));
    needCmd = 'zip';
  } else {
    throw new Error('不支持的压缩格式（支持 tar.gz/zip）');
  }

  if (!(await commandExists(needCmd))) {
    throw new Error(`缺少所需命令：${needCmd} 未安装`);
  }

  // 目标已存在时自动加 _bak 后缀避免冲突
  outPath = dedupePath(outPath);

  if (format === 'tar.gz') {
    cmd = 'tar'; args = ['-czf', outPath, '-C', parent, ...names];
    await sysExec(cmd, args);
  } else {
    cmd = 'zip'; args = ['-r', outPath, ...names];
    await sysExec(cmd, args, { cwd: parent });
  }

  logger.info('Files', `批量压缩 ${names.length} 项 → ${outPath}`);
  return { success: true, path: outPath };
}

// 批量删除，逐项独立，返回每项成败
function batchDelete(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('paths 不能为空');
  }
  const results = [];
  for (const p of paths) {
    try {
      deleteItem(p, true);
      results.push({ path: p, success: true });
    } catch (e) {
      results.push({ path: p, success: false, error: e.message });
    }
  }
  return { results };
}

// 批量移动到同一目标目录，逐项独立
function batchMove(paths, dest) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('paths 不能为空');
  }
  const destResolved = safeResolve(dest);
  if (fs.existsSync(destResolved)) {
    if (!fs.statSync(destResolved).isDirectory()) {
      throw new Error('目标已存在且不是目录');
    }
  } else {
    fs.mkdirSync(destResolved, { recursive: true });
  }

  const results = [];
  for (const p of paths) {
    try {
      move(p, destResolved);
      results.push({ path: p, success: true });
    } catch (e) {
      results.push({ path: p, success: false, error: e.message });
    }
  }
  return { results };
}

module.exports = {
  listDir,
  getFileInfo,
  deleteItem,
  mkdir,
  readFile,
  writeFile,
  rename,
  move,
  copy,
  newFile,
  chmod,
  extract,
  compress,
  batchDelete,
  batchMove,
  batchCompress
};
