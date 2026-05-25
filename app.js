const { createApp } = require('./src/index');
const config = require('./src/services/config');
const nginx = require('./src/services/nginx');
const logger = require('./src/utils/logger');

// Global exception handlers for uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Process', '未捕获的异常', err);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Process', '未处理的 Promise 拒绝', reason instanceof Error ? reason : new Error(String(reason)));
});

const cfg = config.load();
const port = cfg.port || 4567;
const host = cfg.mode === 'proxy' ? '127.0.0.1' : '0.0.0.0';

// Generate self-managed nginx config if in proxy mode
if (cfg.initialized) {
  try { nginx.writeSelfConfig(); } catch (e) { logger.warn('App', '写入 nginx 自管配置失败 (可能未安装 nginx)'); }
}

const app = createApp();

app.listen(port, host, () => {
  logger.info('App', `Worm Panel running on http://${host}:${port}, mode: ${cfg.mode}`);

  if (!cfg.initialized) {
    const { generateSetupToken } = require('./src/services/setup');
    const token = generateSetupToken();
    console.log('────────────────────────────────────────');
    console.log(' First-time setup required!');
    console.log(` Visit http://${host}:${port}/setup`);
    console.log(` Setup token: ${token}`);
    console.log('────────────────────────────────────────');
  }
});
