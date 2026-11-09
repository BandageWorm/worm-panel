const express = require('express');
const cors = require('cors');
const path = require('path');

const authMiddleware = require('./middleware/auth');
const logger = require('./utils/logger');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      if (res.statusCode >= 400) {
        logger.warn('HTTP', `${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
      } else {
        logger.info('HTTP', `${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
      }
    });
    next();
  });

  // Static files (Vue build output)
  const publicDir = path.join(__dirname, '..', 'public');
  // 构建产物文件名带 hash，可长期强缓存；index.html 必须每次回源校验，否则更新后拿不到新入口
  app.use('/assets', express.static(path.join(publicDir, 'assets'), {
    maxAge: '365d',
    immutable: true
  }));
  app.use(express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  // Public routes (no auth required)
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/setup', require('./routes/setup'));

  // Protected routes
  app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));
  app.use('/api/firewall', authMiddleware, require('./routes/firewall'));
  app.use('/api/nginx', authMiddleware, require('./routes/nginx'));
  app.use('/api/ssl', authMiddleware, require('./routes/ssl'));
  app.use('/api/cron', authMiddleware, require('./routes/cron'));
  app.use('/api/notes', authMiddleware, require('./routes/notes'));
  app.use('/api/pm2', authMiddleware, require('./routes/pm2'));
  app.use('/api/xui', authMiddleware, require('./routes/xui'));
  app.use('/api/settings', authMiddleware, require('./routes/settings'));
  app.use('/api/systemd', authMiddleware, require('./routes/systemd'));
  app.use('/api/files', authMiddleware, require('./routes/files'));
  app.use('/api/metrics', authMiddleware, require('./routes/metrics'));
  app.use('/api/traffic', authMiddleware, require('./routes/traffic'));
  app.use('/api/alerts', authMiddleware, require('./routes/alerts'));
  app.use('/api/ports', authMiddleware, require('./routes/ports'));
  app.use('/api/logs', authMiddleware, require('./routes/logs'));

  app.use('/api/sync', authMiddleware, require('./routes/sync'));
  app.use('/api/gitworker', authMiddleware, require('./routes/gitworker'));

  // Drive — 备份盘
  const driveRoute = require('./routes/drive');
  const sync = require('./services/sync');
  driveRoute.setSyncDrive(sync.syncDrive, sync.isDriveSyncing);
  app.use('/api/drive', authMiddleware, driveRoute.router);

  // 文件直链 — 管理接口走 JWT
  const directlinkRoute = require('./routes/directlink');
  app.use('/api/directlink', authMiddleware, directlinkRoute.router);

  // 文件直链 — 公开下载端点，无需鉴权。必须注册在 SPA fallback 之前，否则会被前端路由拦截
  // :filename 段仅用于让 wget/curl 等下载器从 URL 推断文件名，实际按 :token 查文件
  app.get('/d/:token/:filename', directlinkRoute.publicDownload);
  app.get('/d/:token', directlinkRoute.publicDownload);

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(publicDir, 'index.html'));
    }
  });

  return app;
}

module.exports = { createApp };
