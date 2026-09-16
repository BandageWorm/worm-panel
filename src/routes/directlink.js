const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const directlink = require('../services/directlink');
const logger = require('../utils/logger');

const router = Router();

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// 每次上传临时生成一个 token，multer 直接以 token 作为物理文件名存入 files/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    directlink.ensureDirs();
    cb(null, directlink.FILES_DIR);
  },
  filename: (req, file, cb) => {
    const token = directlink.generateToken();
    req._directlinkToken = token;
    cb(null, token);
  }
});

const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

// 根据请求拼接完整直链 URL。
// 末尾带上编码后的原文件名，使 wget/curl 等不读 Content-Disposition 的下载器
// 也能从 URL 路径推断出正确的文件名。
function buildLinkUrl(req, token, originalName) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let url = `${proto}://${host}/d/${token}`;
  if (originalName) {
    url += `/${encodeURIComponent(originalName)}`;
  }
  return url;
}

// 解析原始文件名的编码问题（multer 默认按 latin1 解码）
function decodeOriginalName(name) {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

// ── POST /api/directlink/upload ──
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '文件大小超过 500MB 限制' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    try {
      const token = req._directlinkToken;
      const originalName = decodeOriginalName(req.file.originalname);

      // 解析可选过期时间
      let expiresAt = null;
      if (req.body.expiresAt) {
        const d = new Date(req.body.expiresAt);
        if (!isNaN(d.getTime())) expiresAt = d.toISOString();
      }

      // 计算文件内容 MD5
      const md5 = await directlink.computeMd5(req.file.path);

      const meta = directlink.add(token, {
        originalName,
        size: req.file.size,
        mime: req.file.mimetype,
        md5,
        createdAt: new Date().toISOString(),
        expiresAt
      });

      res.json({
        success: true,
        token,
        url: buildLinkUrl(req, token, originalName),
        ...meta
      });
    } catch (e) {
      // 保存记录失败时清理已落盘的临时文件
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      logger.error('DirectLink', '上传失败', e);
      res.status(500).json({ error: e.message });
    }
  });
});

// ── GET /api/directlink ── 列表
router.get('/', (req, res) => {
  try {
    const items = directlink.list()
      .map(item => ({ ...item, url: buildLinkUrl(req, item.token, item.originalName) }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) {
    logger.error('DirectLink', '列出直链失败', e);
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/directlink/:token ──
router.delete('/:token', (req, res) => {
  try {
    const ok = directlink.remove(req.params.token);
    if (!ok) return res.status(404).json({ error: '直链不存在' });
    res.json({ success: true });
  } catch (e) {
    logger.error('DirectLink', '删除直链失败', e);
    res.status(500).json({ error: e.message });
  }
});

// ── 公开下载处理函数（无需鉴权），由 index.js 挂到 GET /d/:token ──
function publicDownload(req, res) {
  const token = req.params.token;
  const meta = directlink.get(token);

  // token 不存在或已过期 → 404
  if (!meta || directlink.isExpired(meta)) {
    return res.status(404).send('Not Found');
  }

  const fp = directlink.filePath(token);
  if (!fs.existsSync(fp)) {
    return res.status(404).send('Not Found');
  }

  const stat = fs.statSync(fp);
  const total = stat.size;
  const fileName = meta.originalName || token;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', meta.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

  const range = req.headers.range;
  if (range) {
    // 形如 "bytes=start-end"
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`);
      return res.end();
    }
    let start = match[1] === '' ? 0 : parseInt(match[1], 10);
    let end = match[2] === '' ? total - 1 : parseInt(match[2], 10);

    // 区间非法：起点越界或起点大于终点
    if (isNaN(start) || start >= total || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`);
      return res.end();
    }
    if (end >= total) end = total - 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', end - start + 1);
    const stream = fs.createReadStream(fp, { start, end });
    stream.on('error', () => { if (!res.headersSent) res.status(500); res.end(); });
    return stream.pipe(res);
  }

  // 无 Range：完整下载
  res.status(200);
  res.setHeader('Content-Length', total);
  const stream = fs.createReadStream(fp);
  stream.on('error', () => { if (!res.headersSent) res.status(500); res.end(); });
  stream.pipe(res);
}

module.exports = { router, publicDownload };
