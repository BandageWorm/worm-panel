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
  app.use(express.static(publicDir));

  // Public routes (no auth required)
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/setup', require('./routes/setup'));

  // Protected routes
  app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));
  app.use('/api/nginx', authMiddleware, require('./routes/nginx'));
  app.use('/api/ssl', authMiddleware, require('./routes/ssl'));
  app.use('/api/notes', authMiddleware, require('./routes/notes'));
  app.use('/api/pm2', authMiddleware, require('./routes/pm2'));
  app.use('/api/xui', authMiddleware, require('./routes/xui'));
  app.use('/api/settings', authMiddleware, require('./routes/settings'));
  app.use('/api/files', authMiddleware, require('./routes/files'));

  app.use('/api/sync', authMiddleware, require('./routes/sync'));
  app.use('/api/gitworker', authMiddleware, require('./routes/gitworker'));

  // Drive — 备份盘
  const driveRoute = require('./routes/drive');
  const sync = require('./services/sync');
  driveRoute.setSyncDrive(sync.syncDrive, sync.isDriveSyncing);
  app.use('/api/drive', authMiddleware, driveRoute.router);

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(publicDir, 'index.html'));
    }
  });

  return app;
}

module.exports = { createApp };
