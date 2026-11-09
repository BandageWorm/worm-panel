const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./config');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'traffic.json');
const DAY_KEEP = 90;
const IFACE_CACHE_MS = 60000;

const EXCLUDE_PATTERN = /^(lo|docker.*|veth.*|br-.*|virbr.*|tun.*|tap.*|wg.*)$/;

let state = {
  version: 1,
  counters: {},   // iface -> { rx, tx } 上次读到的原始计数器
  days: {},       // 'YYYY-MM-DD' -> { rx, tx }
  period: null    // { key, rx, tx }
};

let ifaceCache = { list: [], at: 0 };

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function dayKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clampResetDay(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, Math.round(n)));
}

// 计费周期起点：重置日之前的日期归到上一个月的重置日
function periodStart(date, resetDay) {
  const day = clampResetDay(resetDay);
  const start = new Date(date.getFullYear(), date.getMonth(), day);
  if (date.getDate() < day) start.setMonth(start.getMonth() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function periodKey(date, resetDay) {
  const s = periodStart(date, resetDay);
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
}

function readDefaultRouteIface() {
  try {
    const lines = fs.readFileSync('/proc/net/route', 'utf8').split('\n').slice(1);
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 2) continue;
      if (cols[1] === '00000000') return cols[0];
    }
  } catch {
    // 非 Linux 环境
  }
  return null;
}

function listSystemIfaces() {
  try {
    const dir = '/sys/class/net';
    if (fs.existsSync(dir)) return fs.readdirSync(dir);
  } catch {
    // ignore
  }
  return Object.keys(os.networkInterfaces() || {});
}

function resolveIfaces(settings) {
  const now = Date.now();
  const raw = String((settings && settings.trafficIfaces) || '').trim();

  if (raw) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (now - ifaceCache.at < IFACE_CACHE_MS && ifaceCache.list.length > 0) {
    return ifaceCache.list;
  }

  let chosen = readDefaultRouteIface();
  if (!chosen) {
    const all = listSystemIfaces().filter(n => !EXCLUDE_PATTERN.test(n));
    chosen = all[0] || null;
  }
  const list = chosen ? [chosen] : [];
  ifaceCache = { list, at: now };
  return list;
}

function validateIfaces(names) {
  if (!Array.isArray(names) || names.length === 0) return [];
  let available;
  try {
    available = listSystemIfaces();
  } catch {
    return [];
  }
  if (available.length === 0) return [];
  return names.filter(n => !available.includes(n));
}

function readCounters(iface) {
  try {
    const base = path.join('/sys/class/net', iface, 'statistics');
    const rx = Number(fs.readFileSync(path.join(base, 'rx_bytes'), 'utf8').trim());
    const tx = Number(fs.readFileSync(path.join(base, 'tx_bytes'), 'utf8').trim());
    if (!Number.isFinite(rx) || !Number.isFinite(tx)) return null;
    return { rx, tx };
  } catch {
    return null;
  }
}

// 纯函数式的差值计算，便于测试：计数器变小视为主机重启，本次不计增量
function diffCounters(state, iface, current) {
  if (!current) return { delta: { rx: 0, tx: 0 }, reset: false };
  const prev = state.counters[iface];
  if (!prev) {
    state.counters[iface] = { ...current };
    return { delta: { rx: 0, tx: 0 }, reset: false };
  }
  if (current.rx < prev.rx || current.tx < prev.tx) {
    state.counters[iface] = { ...current };
    return { delta: { rx: 0, tx: 0 }, reset: true };
  }
  const delta = { rx: current.rx - prev.rx, tx: current.tx - prev.tx };
  state.counters[iface] = { ...current };
  return { delta, reset: false };
}

function pruneDays() {
  const keys = Object.keys(state.days);
  if (keys.length <= DAY_KEEP) return;
  keys.sort();
  for (const key of keys.slice(0, keys.length - DAY_KEEP)) {
    delete state.days[key];
  }
}

function accumulate(now = new Date()) {
  const settings = config.getSettings();
  const ifaces = resolveIfaces(settings);
  const resetDay = clampResetDay(settings.trafficResetDay);

  let drx = 0;
  let dtx = 0;
  for (const iface of ifaces) {
    const current = readCounters(iface);
    const { delta } = diffCounters(state, iface, current);
    drx += delta.rx;
    dtx += delta.tx;
  }

  const key = periodKey(now, resetDay);
  if (!state.period || state.period.key !== key) {
    state.period = { key, rx: 0, tx: 0 };
  }

  if (drx === 0 && dtx === 0) return { drx, dtx, ifaces };

  const dk = dayKey(now);
  if (!state.days[dk]) state.days[dk] = { rx: 0, tx: 0 };
  state.days[dk].rx += drx;
  state.days[dk].tx += dtx;
  state.period.rx += drx;
  state.period.tx += dtx;
  pruneDays();

  return { drx, dtx, ifaces };
}

function quotaBytes() {
  const gb = Number(config.getSettings().trafficQuotaGB) || 0;
  if (gb <= 0) return 0;
  return Math.round(gb * 1024 * 1024 * 1024);
}

function getSummary() {
  const settings = config.getSettings();
  const ifaces = resolveIfaces(settings);
  const resetDay = clampResetDay(settings.trafficResetDay);
  const now = new Date();
  const key = periodKey(now, resetDay);

  // 面板重启后周期可能已滚动，展示时按当前周期校正
  const period = state.period && state.period.key === key
    ? state.period
    : { key, rx: 0, tx: 0 };

  const quota = quotaBytes();
  const used = period.rx + period.tx;
  const percent = quota > 0 ? Math.round((used / quota) * 1000) / 10 : null;

  const days = Object.keys(state.days).sort().slice(-30).map(date => ({
    date,
    rx: state.days[date].rx,
    tx: state.days[date].tx
  }));

  const today = dayKey(now);
  const todayData = state.days[today] || { rx: 0, tx: 0 };

  return {
    approximate: true,
    ifaces,
    resetDay,
    period: {
      key,
      rx: period.rx,
      tx: period.tx,
      quotaBytes: quota || null,
      percent,
      remaining: quota > 0 ? Math.max(0, quota - used) : null
    },
    today: { date: today, rx: todayData.rx, tx: todayData.tx },
    days
  };
}

function getQuotaPercent() {
  const summary = getSummary();
  return summary.period.percent;
}

function saveSync() {
  try {
    ensureDir();
    const tmp = FILE_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
    fs.renameSync(tmp, FILE_PATH);
  } catch (err) {
    logger.warn('Traffic', '流量记录落盘失败：' + (err.message || err));
  }
}

function load() {
  try {
    if (!fs.existsSync(FILE_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    if (raw && typeof raw === 'object') {
      state = {
        version: 1,
        counters: raw.counters || {},
        days: raw.days || {},
        period: raw.period || null
      };
    }
  } catch (err) {
    logger.warn('Traffic', '流量记录无法解析，已重置：' + (err.message || err));
  }
}

// 供采集循环调用
let lastSave = 0;
function tick(now = new Date()) {
  try {
    accumulate(now);
  } catch (err) {
    logger.warn('Traffic', '流量统计失败：' + (err.message || err));
  }
  if (now.getTime() - lastSave > 60000) {
    lastSave = now.getTime();
    saveSync();
  }
}

module.exports = {
  load,
  tick,
  saveNow: saveSync,
  getSummary,
  getQuotaPercent,
  validateIfaces,
  resolveIfaces,
  _test: { periodKey, periodStart, diffCounters, dayKey, clampResetDay }
};
