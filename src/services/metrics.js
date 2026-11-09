const fs = require('fs');
const path = require('path');
const monitor = require('./monitor');
const config = require('./config');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'metrics.json');

const TICK_MS = 5000;
const DETAIL_MAX = 720;           // 1 小时明细（5s × 720）
const MAX_POINTS = 240;           // 单次查询返回点数上限
const PERSIST_EVERY = 12;         // 每 60s 落盘一次

const RANGES = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
};

let detail = [];      // [{ t, cpu, mem, disk, rxSpeed, txSpeed, netRx, netTx }]
let agg = [];         // 1 分钟聚合
let timer = null;
let ticks = 0;
let bucket = null;    // { key, sum, n }
let diskCache = { info: null, at: 0 };
let staticInfo = { cores: 0, model: '' };
let saving = false;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolveRange(range) {
  return RANGES[range] || null;
}

function retentionMax() {
  let days = 7;
  try {
    days = Number(config.getSettings().metricsRetentionDays) || 7;
  } catch {
    // 配置读取失败时按默认 7 天
  }
  days = Math.min(30, Math.max(1, Math.round(days)));
  return days * 1440;
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

// 等距分桶求平均，把任意长度序列压到 maxPoints 以内
function downsample(points, maxPoints = MAX_POINTS) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
  const step = points.length / maxPoints;
  const out = [];
  for (let i = 0; i < maxPoints; i++) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.floor((i + 1) * step));
    const slice = points.slice(start, end);
    if (slice.length === 0) continue;
    const acc = { t: slice[slice.length - 1].t, cpu: 0, mem: 0, disk: 0, rxSpeed: 0, txSpeed: 0 };
    for (const p of slice) {
      acc.cpu += p.cpu || 0;
      acc.mem += p.mem || 0;
      acc.disk += p.disk || 0;
      acc.rxSpeed += p.rxSpeed || 0;
      acc.txSpeed += p.txSpeed || 0;
    }
    const n = slice.length;
    out.push({
      t: acc.t,
      cpu: round1(acc.cpu / n),
      mem: round1(acc.mem / n),
      disk: round1(acc.disk / n),
      rxSpeed: Math.round(acc.rxSpeed / n),
      txSpeed: Math.round(acc.txSpeed / n)
    });
  }
  return out;
}

function pushAggregate(sample) {
  const key = Math.floor(sample.t / 60000);
  if (!bucket || bucket.key !== key) {
    if (bucket) {
      const n = bucket.n || 1;
      agg.push({
        t: bucket.key * 60000,
        cpu: round1(bucket.sum.cpu / n),
        mem: round1(bucket.sum.mem / n),
        disk: round1(bucket.sum.disk / n),
        rxSpeed: Math.round(bucket.sum.rxSpeed / n),
        txSpeed: Math.round(bucket.sum.txSpeed / n)
      });
      const limit = retentionMax();
      if (agg.length > limit) agg = agg.slice(agg.length - limit);
    }
    bucket = { key, n: 0, sum: { cpu: 0, mem: 0, disk: 0, rxSpeed: 0, txSpeed: 0 } };
  }
  bucket.n += 1;
  bucket.sum.cpu += sample.cpu;
  bucket.sum.mem += sample.mem;
  bucket.sum.disk += sample.disk;
  bucket.sum.rxSpeed += sample.rxSpeed;
  bucket.sum.txSpeed += sample.txSpeed;
}

async function readDiskInfo() {
  const now = Date.now();
  if (diskCache.info && now - diskCache.at < 60000) return diskCache.info;
  try {
    const disk = await monitor.getDiskUsage();
    diskCache = { info: disk, at: now };
  } catch {
    // 保留上一次的值
  }
  return diskCache.info || { total: 0, used: 0, percent: 0, mount: '/' };
}

async function sample() {
  const now = Date.now();
  const [cpu, memory, network] = await Promise.all([
    monitor.getCpuUsage(),
    monitor.getMemoryUsage(),
    monitor.getNetworkStats()
  ]);
  const disk = await readDiskInfo();

  if (!staticInfo.cores && cpu.cores) {
    staticInfo = { cores: cpu.cores, model: cpu.model || '' };
  }

  const point = {
    t: now,
    cpu: round1(cpu.usage),
    mem: round1(memory.percent),
    disk: round1(disk.percent || 0),
    rxSpeed: Math.round(network.rxSpeed || 0),
    txSpeed: Math.round(network.txSpeed || 0),
    netRx: network.rxBytes || 0,
    netTx: network.txBytes || 0,
    memTotal: memory.total || 0,
    memUsed: memory.used || 0,
    memAvailable: memory.available || 0,
    diskTotal: disk.total || 0,
    diskUsed: disk.used || 0,
    diskMount: disk.mount || '/',
    cores: staticInfo.cores,
    cpuModel: staticInfo.model
  };

  detail.push(point);
  if (detail.length > DETAIL_MAX) detail = detail.slice(detail.length - DETAIL_MAX);
  pushAggregate(point);
  return point;
}

async function tick() {
  try {
    await sample();
  } catch (err) {
    // 单次采样失败不影响后续
    logger.warn('Metrics', '采样失败：' + (err.message || err));
  }

  ticks += 1;
  if (ticks % PERSIST_EVERY === 0) save();
}

function start() {
  if (timer) return;
  load();
  tick();
  timer = setInterval(tick, TICK_MS);
  logger.info('Metrics', `指标采集已启动（${TICK_MS / 1000}s 间隔）`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  save();
}

function getLatest() {
  if (detail.length > 0) return detail[detail.length - 1];
  return null;
}

function query(range) {
  const span = RANGES[range];
  if (!span) return null;
  const since = Date.now() - span;
  let source = range === '1h' ? detail : agg;
  if (range === '1h' && detail.length === 0) source = agg;
  const points = downsample(source.filter(p => p.t >= since));
  return {
    range,
    interval: range === '1h' ? TICK_MS : 60000,
    points: points.map(p => ({ t: p.t, cpu: p.cpu, mem: p.mem, disk: p.disk, rxSpeed: p.rxSpeed, txSpeed: p.txSpeed }))
  };
}

function saveSync() {
  if (saving) return;
  saving = true;
  try {
    ensureDir();
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      detail: detail.slice(-DETAIL_MAX),
      agg: agg.slice(-retentionMax())
    };
    const tmp = FILE_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
    fs.renameSync(tmp, FILE_PATH);
  } catch (err) {
    logger.warn('Metrics', '历史落盘失败：' + (err.message || err));
  } finally {
    saving = false;
  }
}

function save() {
  // 定时落盘走异步节流，避免阻塞采样循环
  setImmediate(saveSync);
}

function load() {
  try {
    if (!fs.existsSync(FILE_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
    if (Array.isArray(raw.detail)) detail = raw.detail.slice(-DETAIL_MAX);
    if (Array.isArray(raw.agg)) agg = raw.agg.slice(-retentionMax());
  } catch (err) {
    // 文件损坏：以空历史启动，不阻断服务
    logger.warn('Metrics', '历史文件无法解析，已重置：' + (err.message || err));
    detail = [];
    agg = [];
  }
}

module.exports = {
  start,
  stop,
  saveNow: saveSync,
  getLatest,
  query,
  _test: { downsample, resolveRange, retentionMax, RANGES, MAX_POINTS }
};
