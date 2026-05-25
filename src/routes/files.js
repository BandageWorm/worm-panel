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
    const result = files.deleteItem(itemPath);
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

module.exports = router;
