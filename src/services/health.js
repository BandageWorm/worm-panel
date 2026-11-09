const acme = require('./acme');
const nginx = require('./nginx');
const pm2 = require('./pm2');
const config = require('./config');
const metrics = require('./metrics');
const traffic = require('./traffic');
const monitor = require('./monitor');
const logger = require('../utils/logger');

const CACHE_MS = 60000;
const PM2_CACHE_MS = 60000;

let cache = null;
let cacheAt = 0;
let inflight = null;
let pm2Cache = { at: 0, list: null, error: null };

const STATUS_WEIGHT = { ok: 0, unknown: 0, warn: 1, error: 2 };

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 查询超时`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function daysUntil(value) {
  const d = parseDate(value);
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function item(id, label, status, detail, target) {
  return { id, label, status, detail, target };
}

function worstStatus(items) {
  return items.reduce((acc, cur) => (STATUS_WEIGHT[cur.status] > STATUS_WEIGHT[acc] ? cur.status : acc), 'ok');
}

function certItem() {
  try {
    const certs = acme.listCerts();
    if (!Array.isArray(certs) || certs.length === 0) {
      return item('cert', '证书', 'ok', '暂无证书', '/ssl');
    }
    const withDays = certs
      .map(c => ({ domain: c.domain, days: daysUntil(c.expireDate) }))
      .filter(c => c.days !== null)
      .sort((a, b) => a.days - b.days);

    if (withDays.length === 0) {
      return item('cert', '证书', 'unknown', `${certs.length} 张证书无法读取有效期`, '/ssl');
    }

    const soonest = withDays[0];
    let status = 'ok';
    if (soonest.days <= 7) status = 'error';
    else if (soonest.days <= 14) status = 'warn';

    const extra = withDays.length > 1 ? `（共 ${withDays.length} 张）` : '';
    return item('cert', '证书', status, `${soonest.domain} 剩余 ${soonest.days} 天${extra}`, '/ssl');
  } catch (err) {
    return item('cert', '证书', 'unknown', '无法读取证书信息：' + (err.message || err), '/ssl');
  }
}

function backupItem() {
  const cfg = config.load();
  const syncCfg = cfg.sync || {};
  const settings = config.getSettings(cfg);

  if (!syncCfg.webdavUrl) {
    return item('backup', '云备份', 'ok', '未启用云备份', '/sync');
  }
  if (syncCfg.lastStatus === 'fail') {
    return item('backup', '云备份', 'error', '最近一次备份失败', '/sync');
  }
  if (!syncCfg.lastSync) {
    return item('backup', '云备份', 'warn', '尚未执行过备份', '/sync');
  }

  const hours = (Date.now() - new Date(syncCfg.lastSync).getTime()) / 3600000;
  const interval = Number(settings.syncInterval) || 0;
  if (interval > 0 && hours > interval * 2) {
    return item('backup', '云备份', 'warn', `已 ${Math.round(hours)} 小时未成功同步`, '/sync');
  }
  return item('backup', '云备份', 'ok', `最近同步 ${new Date(syncCfg.lastSync).toLocaleString('zh-CN')}`, '/sync');
}

async function getPm2List() {
  if (pm2Cache.list && Date.now() - pm2Cache.at < PM2_CACHE_MS) return pm2Cache;
  try {
    const list = await withTimeout(pm2.list(), 5000, 'PM2');
    pm2Cache = { at: Date.now(), list, error: null };
  } catch (err) {
    pm2Cache = { at: Date.now(), list: null, error: err.message || String(err) };
  }
  return pm2Cache;
}

async function serviceItem() {
  const problems = [];
  let status = 'ok';

  let nginxDetail = 'Nginx 运行正常';
  try {
    const st = await withTimeout(nginx.getStatus(), 5000, 'Nginx');
    if (!st.running) {
      status = 'error';
      nginxDetail = 'Nginx 未运行';
      problems.push(nginxDetail);
    } else if (!st.configValid) {
      status = 'error';
      nginxDetail = 'Nginx 配置校验失败';
      problems.push(nginxDetail);
    }
  } catch (err) {
    if (status === 'ok') status = 'unknown';
    nginxDetail = 'Nginx 状态未知：' + (err.message || err);
    problems.push(nginxDetail);
  }

  const pm2State = await getPm2List();
  let pm2Detail = 'PM2 正常';
  if (pm2State.error) {
    if (status === 'ok') status = 'unknown';
    pm2Detail = 'PM2 状态未知';
  } else if (Array.isArray(pm2State.list)) {
    const bad = pm2State.list.filter(p => p.status === 'errored' || p.status === 'stopped');
    if (bad.length > 0) {
      if (STATUS_WEIGHT['warn'] > STATUS_WEIGHT[status]) status = 'warn';
      pm2Detail = `${bad.length} 个 PM2 进程异常`;
      problems.push(pm2Detail);
    }
  }

  const panelDetail = '面板运行中';
  const detail = problems.length > 0 ? problems.join('；') : `${nginxDetail} · ${pm2Detail} · ${panelDetail}`;
  return item('service', '服务', status, detail, status === 'ok' ? '/systemd' : '/pm2');
}

function levelOfPercent(value, warn, error) {
  if (!Number.isFinite(value)) return 'unknown';
  if (value >= error) return 'error';
  if (value >= warn) return 'warn';
  return 'ok';
}

function resourceItems(latest) {
  const result = [];

  const diskPercent = latest ? latest.disk : null;
  result.push(item(
    'disk',
    '磁盘',
    levelOfPercent(diskPercent, 80, 90),
    diskPercent === null ? '暂无法读取' : `根分区已用 ${diskPercent}%`,
    '/files'
  ));

  const memPercent = latest ? latest.mem : null;
  result.push(item(
    'memory',
    '内存',
    levelOfPercent(memPercent, 90, 101),
    memPercent === null ? '暂无法读取' : `已用 ${memPercent}%`,
    '/dashboard'
  ));

  const quotaPercent = traffic.getQuotaPercent();
  if (quotaPercent !== null && quotaPercent !== undefined) {
    result.push(item(
      'traffic',
      '流量',
      levelOfPercent(quotaPercent, 80, 95),
      `本月已用配额 ${quotaPercent}%`,
      '/dashboard'
    ));
  }

  return result;
}

async function compute() {
  const latest = metrics.getLatest();
  let fallback = latest;
  if (!fallback) {
    try {
      const [cpu, memory, disk] = await Promise.all([
        monitor.getCpuUsage(),
        monitor.getMemoryUsage(),
        monitor.getDiskUsage()
      ]);
      fallback = { cpu: cpu.usage, mem: memory.percent, disk: disk.percent };
    } catch {
      fallback = null;
    }
  }

  const service = await serviceItem();
  const items = [
    certItem(),
    backupItem(),
    service,
    ...resourceItems(fallback)
  ];

  return {
    status: worstStatus(items),
    items,
    cachedAt: new Date().toISOString()
  };
}

async function getHealth() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  if (inflight) return inflight;

  inflight = compute()
    .then(result => {
      cache = result;
      cacheAt = Date.now();
      return result;
    })
    .catch(err => {
      logger.warn('Health', '健康汇总失败：' + (err.message || err));
      return { status: 'unknown', items: [], cachedAt: new Date().toISOString() };
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

function clearCache() {
  cache = null;
  cacheAt = 0;
  pm2Cache = { at: 0, list: null, error: null };
}

module.exports = {
  getHealth,
  clearCache,
  _test: { levelOfPercent, daysUntil, worstStatus }
};
