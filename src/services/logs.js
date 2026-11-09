const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CRON_HISTORY_DIR = path.join(DATA_DIR, 'cron-history');

const DEFAULT_LINES = 200;
const MAX_LINES = 2000;
const MAX_BUFFER = 8 * 1024 * 1024;

const HOME = process.env.HOME || '/root';

// 每个文件源只允许在这些根目录内读取，客户端永远不直接传路径
const FILE_ROOTS = {
  nginx: ['/var/log/nginx', '/var/log'],
  pm2: [
    path.join(HOME, '.pm2', 'logs'),
    path.join(DATA_DIR, 'logs'),
    '/opt/worm-panel/data/logs',
    '/root/worm-panel/data/logs'
  ]
};

function encodeFileId(filePath) {
  return Buffer.from(filePath, 'utf8').toString('base64url');
}

function decodeFileId(fileId) {
  try {
    return Buffer.from(String(fileId), 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function safeRealPath(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function isInsideRoots(target, roots) {
  const real = safeRealPath(target);
  if (!real) return false;
  for (const root of roots) {
    const realRoot = safeRealPath(root);
    if (!realRoot) continue;
    if (real === realRoot) return true;
    if (real.startsWith(realRoot + path.sep)) return true;
  }
  return false;
}

function fileEntry(sourceId, filePath) {
  let size = 0;
  let updatedAt = null;
  try {
    const stat = fs.statSync(filePath);
    size = stat.size;
    updatedAt = stat.mtime.toISOString();
  } catch {
    // 文件可能刚被轮转
  }
  return {
    id: encodeFileId(filePath),
    label: path.basename(filePath),
    path: filePath,
    size,
    updatedAt
  };
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function discoverNginxFiles() {
  const files = [];
  const defaults = ['/var/log/nginx/access.log', '/var/log/nginx/error.log', '/var/log/nginx/access.log.1'];
  for (const p of defaults) {
    if (existsFile(p)) files.push(p);
  }

  const confDirs = ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d'];
  for (const dir of confDirs) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.conf')) continue;
      let content = '';
      try {
        content = fs.readFileSync(path.join(dir, entry), 'utf8');
      } catch {
        continue;
      }
      const re = /(?:access_log|error_log)\s+([^\s;]+)/g;
      let match;
      while ((match = re.exec(content)) !== null) {
        const target = match[1];
        if (!target.startsWith('/')) continue;
        if (!existsFile(target)) continue;
        if (!files.includes(target)) files.push(target);
      }
    }
  }
  return [...new Set(files)];
}

function discoverPm2Files() {
  const files = [];
  for (const dir of FILE_ROOTS.pm2) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.log')) continue;
      const full = path.join(dir, entry);
      if (!files.includes(full)) files.push(full);
    }
  }
  return files;
}

function listSources() {
  const journalAvailable = (() => {
    try {
      // journalctl 存在即可用，实际会以退出码兜底
      execFileSync('which', ['journalctl'], { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  })();

  return [
    {
      id: 'panel',
      label: '面板',
      type: 'journal',
      available: journalAvailable,
      files: journalAvailable ? [{ id: 'panel', label: 'worm-panel（journald）', path: 'journalctl -u worm-panel' }] : []
    },
    {
      id: 'nginx',
      label: 'Nginx',
      type: 'file',
      available: true,
      files: discoverNginxFiles().map(p => fileEntry('nginx', p))
    },
    {
      id: 'pm2',
      label: 'PM2',
      type: 'file',
      available: true,
      files: discoverPm2Files().map(p => fileEntry('pm2', p))
    },
    {
      id: 'system',
      label: '系统',
      type: 'journal',
      available: journalAvailable,
      files: journalAvailable ? [{ id: 'system', label: 'system（journald）', path: 'journalctl' }] : []
    },
    {
      id: 'cron',
      label: '计划任务',
      type: 'structured',
      available: fs.existsSync(CRON_HISTORY_DIR),
      files: [{ id: 'cron', label: '执行历史', path: CRON_HISTORY_DIR }]
    }
  ];
}

function normalizeLines(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return DEFAULT_LINES;
  return Math.min(MAX_LINES, Math.max(1, n));
}

async function readJournal(unit, lines) {
  const args = ['-n', String(lines), '--no-pager', '-o', 'short-iso'];
  if (unit) args.unshift('-u', unit);

  try {
    const { stdout } = await execFileAsync('journalctl', args, {
      timeout: 15000,
      maxBuffer: MAX_BUFFER
    });
    return stdout.split('\n');
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('主机上没有 journalctl，无法读取该日志源');
    const output = (err.stdout || err.stderr || err.message || '').toString().trim();
    throw new Error('读取 journald 失败：' + output.slice(0, 300));
  }
}

// 倒着读文件尾部，避免 readFileSync 整个大文件
function readTailManually(filePath, lines) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  if (size === 0) return [];

  const chunkSize = 64 * 1024;
  let position = size;
  let collected = '';

  while (position > 0) {
    const readSize = Math.min(chunkSize, position);
    position -= readSize;
    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(filePath, 'r');
    try {
      fs.readSync(fd, buffer, 0, readSize, position);
    } finally {
      fs.closeSync(fd);
    }
    collected = buffer.toString('utf8') + collected;
    const count = collected.split('\n').length;
    if (count > lines + 1) break;
  }

  return collected.split('\n');
}

async function readFileTail(filePath, lines) {
  try {
    const { stdout } = await execFileAsync('tail', ['-n', String(lines), filePath], {
      timeout: 15000,
      maxBuffer: MAX_BUFFER
    });
    return stdout.split('\n');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      const output = (err.stderr || err.message || '').toString().trim();
      throw new Error('读取日志失败：' + output.slice(0, 300));
    }
    // 没有 tail 命令时退化为自行分块倒读
    return readTailManually(filePath, lines);
  }
}

function readCronHistory(lines) {
  const records = [];
  let entries = [];
  try {
    entries = fs.readdirSync(CRON_HISTORY_DIR).filter(f => f.endsWith('.jsonl'));
  } catch {
    return [];
  }

  for (const entry of entries) {
    const taskId = entry.replace(/\.jsonl$/, '');
    let content = '';
    try {
      content = fs.readFileSync(path.join(CRON_HISTORY_DIR, entry), 'utf8');
    } catch {
      continue;
    }
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        const record = JSON.parse(line);
        records.push({
          time: record.time,
          taskId,
          text: `[${record.time}] 任务 ${taskId} 退出码 ${record.exitCode} 耗时 ${record.duration}ms${record.timeout ? ' 超时' : ''}`
        });
      } catch {
        // 跳过损坏行
      }
    }
  }

  records.sort((a, b) => String(b.time).localeCompare(String(a.time)));
  return records.slice(0, lines).map(r => r.text);
}

function applyFilter(lines, keyword) {
  const clean = lines.map(l => l.replace(/\r$/, '')).filter(l => l !== '');
  if (!keyword) return { lines: clean, matched: clean.length, total: clean.length };
  const needle = String(keyword).toLowerCase();
  const matched = clean.filter(l => l.toLowerCase().includes(needle));
  return { lines: matched, matched: matched.length, total: clean.length };
}

async function readLog({ sourceId, fileId, lines, keyword } = {}) {
  const source = listSources().find(s => s.id === sourceId);
  if (!source) throw new Error('未知的日志源');
  if (!source.available) throw new Error('该日志源在当前主机不可用');

  const limit = normalizeLines(lines);
  let raw = [];

  if (source.type === 'journal') {
    raw = await readJournal(sourceId === 'system' ? null : 'worm-panel', limit);
  } else if (source.type === 'structured') {
    raw = readCronHistory(limit);
  } else {
    if (!fileId) throw new Error('请选择要查看的日志文件');
    const realPath = decodeFileId(fileId);
    if (!realPath) throw new Error('日志文件标识无效');

    const roots = FILE_ROOTS[sourceId];
    if (!roots) throw new Error('该日志源不支持文件读取');
    if (!isInsideRoots(realPath, roots)) {
      throw new Error('日志文件路径不在允许范围内');
    }
    if (!existsFile(realPath)) {
      throw new Error('日志文件不存在，可能已被轮转或删除');
    }
    raw = await readFileTail(realPath, limit);
  }

  const filtered = applyFilter(raw, keyword);
  return {
    sourceId,
    fileId: fileId || null,
    lines: filtered.lines,
    matched: filtered.matched,
    total: filtered.total,
    keyword: keyword || '',
    readAt: new Date().toISOString()
  };
}

module.exports = {
  listSources,
  readLog,
  _test: { encodeFileId, decodeFileId, isInsideRoots, applyFilter, normalizeLines, FILE_ROOTS }
};
