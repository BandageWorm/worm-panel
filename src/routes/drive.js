const { Router } = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const multer = require('multer');
const logger = require('../utils/logger');

const router = Router();

const DRIVE_DIR = path.join(__dirname, '..', '..', 'data', 'drive');
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// ── Multer setup ──

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const relPath = (req.body.path || '/').replace(/\\/g, '/');
    const targetDir = resolveSafePath(relPath);
    if (!targetDir) return cb(new Error('Invalid path'));
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    let name = file.originalname;
    const dest = resolveSafePath(req.body.path || '/');
    if (dest && fs.existsSync(path.join(dest, name))) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      name = `${base}_${Date.now()}${ext}`;
    }
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE }
});

// ── Path safety ──

function resolveSafePath(userPath) {
  const normalized = path.normalize(userPath || '/').replace(/\\/g, '/');
  const safe = path.resolve(DRIVE_DIR, normalized.startsWith('/') ? '.' + normalized : normalized);
  if (!safe.startsWith(DRIVE_DIR)) return null;
  return safe;
}

function toEntry(name, fullPath) {
  try {
    const stat = fs.statSync(fullPath);
    return {
      name,
      type: stat.isDirectory() ? 'dir' : 'file',
      size: stat.isDirectory() ? 0 : stat.size,
      mtime: stat.mtime.toISOString()
    };
  } catch {
    return null;
  }
}

// ── WebDAV sync helper (injected by index.js) ──
let syncDriveFn = null;
let isDriveSyncingFn = null;
function setSyncDrive(fn, syncingFn) { syncDriveFn = fn; isDriveSyncingFn = syncingFn; }
function triggerSync() {
  if (typeof syncDriveFn === 'function') {
    syncDriveFn().catch(err => logger.warn('Drive', '同步失败: ' + err.message));
  }
}

// ── GET /api/drive/list ──

router.get('/list', (req, res) => {
  try {
    const relPath = (req.query.path || '/').replace(/\\/g, '/');
    const target = resolveSafePath(relPath);
    if (!target) return res.status(400).json({ error: 'Invalid path' });

    if (!fs.existsSync(target)) {
      return res.status(404).json({ error: '目录不存在' });
    }

    const entries = fs.readdirSync(target, { withFileTypes: true })
      .filter(dirent => !dirent.name.startsWith('.'))
      .map(dirent => toEntry(dirent.name, path.join(target, dirent.name)))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });

    const currentPath = path.normalize(relPath).replace(/\\/g, '/');

    res.json({
      path: currentPath,
      entries,
      isSyncing: typeof isDriveSyncingFn === 'function' ? isDriveSyncingFn() : false
    });
  } catch (e) {
    logger.error('Drive', '列出文件失败', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/drive/upload ──

router.post('/upload', (req, res) => {
  upload.array('files', 50)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: '文件大小超过 500MB 限制' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    const files = req.files || [];
    const result = files.map(f => ({
      name: f.filename,
      size: f.size,
      type: 'file',
      mtime: new Date(f.mtime || Date.now()).toISOString()
    }));

    triggerSync();
    res.json({ files: result });
  });
});

// ── GET /api/drive/download ──

router.get('/download', (req, res) => {
  try {
    const relPath = (req.query.path || '').replace(/\\/g, '/');
    const target = resolveSafePath(relPath);
    if (!target) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(target)) return res.status(404).json({ error: '文件不存在' });

    const stat = fs.statSync(target);
    if (stat.isDirectory()) return res.status(400).json({ error: '不支持下载文件夹' });

    const fileName = path.basename(target);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    const stream = fs.createReadStream(target);
    stream.pipe(res);
  } catch (e) {
    logger.error('Drive', '下载失败', e);
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/drive/ ──

router.delete('/', async (req, res) => {
  try {
    const relPath = (req.body.path || '').replace(/\\/g, '/');
    if (!relPath) return res.status(400).json({ error: 'path 不能为空' });

    const target = resolveSafePath(relPath);
    if (!target) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(target)) return res.status(404).json({ error: '文件或目录不存在' });

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      await fsp.rm(target, { recursive: true, force: true });
    } else {
      await fsp.unlink(target);
    }

    triggerSync();
    res.json({ success: true });
  } catch (e) {
    logger.error('Drive', '删除失败', e);
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/drive/rename ──

router.put('/rename', async (req, res) => {
  try {
    const { path: relPath, newName } = req.body;
    if (!relPath || !newName) return res.status(400).json({ error: 'path 和 newName 不能为空' });

    const target = resolveSafePath(relPath);
    if (!target) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(target)) return res.status(404).json({ error: '文件或目录不存在' });

    const parentDir = path.dirname(target);
    const newPath = path.join(parentDir, newName);

    if (fs.existsSync(newPath)) {
      return res.status(409).json({ error: '同名文件或文件夹已存在' });
    }

    await fsp.rename(target, newPath);

    const stat = fs.statSync(newPath);
    triggerSync();
    res.json({
      success: true,
      entry: {
        name: newName,
        type: stat.isDirectory() ? 'dir' : 'file',
        size: stat.isDirectory() ? 0 : stat.size,
        mtime: stat.mtime.toISOString()
      }
    });
  } catch (e) {
    logger.error('Drive', '重命名失败', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/drive/mkdir ──

router.post('/mkdir', async (req, res) => {
  try {
    const relPath = (req.body.path || '').replace(/\\/g, '/');
    if (!relPath) return res.status(400).json({ error: 'path 不能为空' });

    const target = resolveSafePath(relPath);
    if (!target) return res.status(400).json({ error: 'Invalid path' });

    if (fs.existsSync(target)) {
      return res.status(409).json({ error: '文件夹已存在' });
    }

    await fsp.mkdir(target, { recursive: true });
    triggerSync();
    res.json({ success: true, entry: { name: path.basename(relPath), type: 'dir', size: 0, mtime: new Date().toISOString() } });
  } catch (e) {
    logger.error('Drive', '创建文件夹失败', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, setSyncDrive };
