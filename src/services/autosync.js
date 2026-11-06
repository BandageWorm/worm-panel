const config = require('./config');
const sync = require('./sync');
const logger = require('../utils/logger');

// 云备份自动同步：周期取自 config.settings.syncInterval（小时），0 表示关闭。
// 设置页保存后会调用 start() 重新排期，无需重启面板。
let timer = null;

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function start() {
  stop();

  const cfg = config.load();
  const { syncInterval } = config.getSettings(cfg);
  const connected = !!(cfg.sync && cfg.sync.webdavUrl);
  const hours = Number(syncInterval);

  if (!hours || hours <= 0) {
    logger.info('Sync', '自动同步已关闭（周期为 0）');
    return { active: false, hours: 0 };
  }
  if (!connected) {
    logger.info('Sync', 'WebDAV 未连接，自动同步未启用');
    return { active: false, hours };
  }

  timer = setInterval(() => {
    sync.triggerBackup();
    sync.syncDrive().catch(err => logger.warn('Sync', '自动同步备份盘失败: ' + err.message));
  }, hours * 60 * 60 * 1000);

  logger.info('Sync', `自动同步已启用：每 ${hours} 小时`);
  return { active: true, hours };
}

function getState() {
  return { active: !!timer };
}

module.exports = { start, stop, getState };
