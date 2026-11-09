const https = require('https');
const http = require('http');
const { WebSocketServer } = require('ws');
const { createApp } = require('./src/index');
const config = require('./src/services/config');
const nginx = require('./src/services/nginx');
const cert = require('./src/services/cert');
const autosync = require('./src/services/autosync');
const metrics = require('./src/services/metrics');
const traffic = require('./src/services/traffic');
const alerts = require('./src/services/alerts');
const { createTerminal } = require('./src/services/terminal');
const logger = require('./src/utils/logger');

// Global exception handlers for uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Process', '未捕获的异常', err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Process', '未处理的 Promise 拒绝', reason instanceof Error ? reason : new Error(String(reason)));
});

// 退出前同步落盘：设置页的重启按钮直接 process.exit()，不会触发 beforeExit
process.on('exit', () => {
  try { metrics.saveNow(); } catch {}
  try { traffic.saveNow(); } catch {}
  try { alerts.stop(); } catch {}
});
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { metrics.stop(); } catch {}
    try { alerts.stop(); } catch {}
    process.exit(0);
  });
}

let trafficTimer = null;

function startCollectors() {
  metrics.start();
  traffic.load();
  traffic.tick(new Date());
  trafficTimer = setInterval(() => traffic.tick(new Date()), 10000);
  if (trafficTimer.unref) trafficTimer.unref();
  alerts.start();
}

const cfg = config.load();
const port = cfg.port || 4567;
const host = cfg.mode === 'proxy' ? '127.0.0.1' : '0.0.0.0';

// Generate self-managed nginx config if in proxy mode
if (cfg.initialized) {
  try { nginx.writeSelfConfig(); nginx.writeDefaultConfig(); } catch (e) { logger.warn('App', '写入 nginx 配置失败 (可能未安装 nginx)'); }
}

const app = createApp();

function startServer(server) {
  // Attach WebSocket server for terminal
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    createTerminal(ws, req);
  });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, host, () => {
    const protocol = server instanceof https.Server ? 'https' : 'http';
    logger.info('App', `Worm Panel running on ${protocol}://${host}:${port}, mode: ${cfg.mode}`);
    showSetupInfo(host, port, protocol);

    // Start 12-hour periodic sync
    startPeriodicSync();

    // 指标采集与流量统计
    startCollectors();
  });
}

const useHttps = cfg.mode !== 'proxy';

if (useHttps) {
  try {
    const sslCreds = cert.get();
    const server = https.createServer(sslCreds, app);
    startServer(server);
  } catch (e) {
    logger.error('App', '生成 SSL 证书失败，回退到 HTTP', e);
    const server = http.createServer(app);
    startServer(server);
  }
} else {
  const server = http.createServer(app);
  startServer(server);
}

function startPeriodicSync() {
  autosync.start();
}

function showSetupInfo(host, port, protocol) {
  if (!cfg.initialized) {
    const { generateSetupToken } = require('./src/services/setup');
    const token = generateSetupToken();
    console.log('────────────────────────────────────────');
    console.log(' First-time setup required!');
    console.log(` Visit ${protocol}://${host}:${port}/setup`);
    console.log(` Setup token: ${token}`);
    console.log('────────────────────────────────────────');
  }
}
