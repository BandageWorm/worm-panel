const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const files = require('../services/files');
const logger = require('../utils/logger');

const router = Router();

// Multer config: store in temp then move
const upload = multer({ dest: '/tmp/worm-upload/' });

// List directory
router.get('/', (req, res) => {
  try {
    const dirPath = req.query.path || '/';
    const result = files.listDir(dirPath);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Download file
router.get('/download', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: '路径不能为空' });
    }
    const info = files.getFileInfo(filePath);
    res.download(info.path, info.name);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Upload file
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    const destDir = req.query.path || '/';
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const targetDir = path.resolve(destDir);
    const targetPath = path.join(targetDir, req.file.originalname);

    // Ensure targetDir starts with /
    if (!targetDir.startsWith('/')) {
      // Clean up temp file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '只允许绝对路径' });
    }

    // Move file from temp location
    fs.renameSync(req.file.path, targetPath);

    res.json({ success: true, name: req.file.originalname, path: targetPath });
  } catch (e) {
    // Clean up temp file if exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    logger.error('Files', '上传文件失败', e);
    res.status(400).json({ error: e.message });
  }
});

// Delete file/dir
router.delete('/', (req, res) => {
  try {
    const itemPath = req.query.path;
    if (!itemPath) {
      return res.status(400).json({ error: '路径不能为空' });
    }
    const recursive = req.query.recursive === 'true' || req.query.recursive === '1';
    const result = files.deleteItem(itemPath, recursive);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Make directory
router.post('/mkdir', (req, res) => {
  try {
    const dirPath = req.body.path;
    if (!dirPath) {
      return res.status(400).json({ error: '路径不能为空' });
    }
    const result = files.mkdir(dirPath);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Read file content
router.get('/read', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: '路径不能为空' });
    }
    const result = files.readFile(filePath);
    res.json(result);
  } catch (e) {
    const status = e.message === '文件不存在' ? 404
      : e.message === '文件过大无法编辑（超过 1MB）' ? 413
      : 400;
    res.status(status).json({ error: e.message });
  }
});

// Write file content
router.put('/write', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: '路径不能为空' });
    }
    if (content === undefined || content === null) {
      return res.status(400).json({ error: '内容不能为空' });
    }
    const result = files.writeFile(filePath, content);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 将 service 错误信息映射为 HTTP 状态码
function statusFor(msg) {
  if (/不存在/.test(msg)) return 404;
  return 400;
}

// Rename
router.post('/rename', (req, res) => {
  try {
    const { path: itemPath, newName } = req.body;
    if (!itemPath) return res.status(400).json({ error: '路径不能为空' });
    const result = files.rename(itemPath, newName);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

// Move
router.post('/move', (req, res) => {
  try {
    const { src, dest } = req.body;
    if (!src || !dest) return res.status(400).json({ error: 'src 和 dest 不能为空' });
    const result = files.move(src, dest);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

// Copy
router.post('/copy', (req, res) => {
  try {
    const { src, dest } = req.body;
    if (!src || !dest) return res.status(400).json({ error: 'src 和 dest 不能为空' });
    const result = files.copy(src, dest);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

// New empty file
router.post('/newfile', (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: '路径不能为空' });
    const result = files.newFile(filePath);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

// Extract archive
router.post('/extract', async (req, res) => {
  try {
    const { path: archivePath, dest } = req.body;
    if (!archivePath) return res.status(400).json({ error: '路径不能为空' });
    const result = await files.extract(archivePath, dest);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

// Compress
router.post('/compress', async (req, res) => {
  try {
    const { path: itemPath, format, dest } = req.body;
    if (!itemPath) return res.status(400).json({ error: '路径不能为空' });
    const result = await files.compress(itemPath, format, dest);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

// Chmod
router.post('/chmod', async (req, res) => {
  try {
    const { path: itemPath, mode } = req.body;
    if (!itemPath) return res.status(400).json({ error: '路径不能为空' });
    const result = await files.chmod(itemPath, mode);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

// Batch delete
router.post('/batch-delete', (req, res) => {
  try {
    const { paths } = req.body;
    const result = files.batchDelete(paths);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Batch move
router.post('/batch-move', (req, res) => {
  try {
    const { paths, dest } = req.body;
    const result = files.batchMove(paths, dest);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

// Batch compress
router.post('/batch-compress', async (req, res) => {
  try {
    const { paths, format, dest } = req.body;
    const result = await files.batchCompress(paths, format, dest);
    res.json(result);
  } catch (e) {
    res.status(statusFor(e.message)).json({ error: e.message });
  }
});

module.exports = router;
