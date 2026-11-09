const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./config');
const notify = require('./notify');
const metrics = require('./metrics');
const traffic = require('./traffic');
const health = require('./health');
const acme = require('./acme');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'alerts.json');
const STATE_FILE = path.join(DATA_DIR, 'alert-state.json');
const PENDING_FILE = path.join(DATA_DIR, 'alert-pending.json');

const TICK_MS = 5000;
const MAX_HISTORY = 200;
const PENDING_MAX_ATTEMPTS = 3;
const PENDING_BACKOFF = [60000, 300000, 900000];
const RECOVERY_MISS = 2;
const CERT_CACHE_MS = 10 * 60000;
const PENDING_TTL_MS = 24 * 3600 * 1000;

const LEVEL_WEIGHT = { info: 0, warn: 1, error: 2 };

const RULES = {
  disk: {
    label: '磁盘使用率', kind: 'threshold', level: 'warn',
    threshold: 90, unit: '%', cooldownMinutes: 360, sustainMs: 0,
    description: '根分区使用率超过阈值'
  },
  memory: {
    label: '内存使用率', kind: 'threshold', level: 'warn',
    threshold: 90, unit: '%', cooldownMinutes: 360, sustainMs: 5 * 60000,
    description: '内存使用率持续超过阈值'
  },
  load: {
    label: '系统负载', kind: 'threshold', level: 'warn',
    threshold: 2, unit: '×核数', cooldownMinutes: 360, sustainMs: 10 * 60000,
    description: '1 分钟平均负载持续超过「核数 × 阈值」'
  },
  trafficQuota: {
    label: '月流量配额', kind: 'threshold', level: 'warn',
    threshold: 80, unit: '%', cooldownMinutes: 720, sustainMs: 0,
    description: '本月流量超过配额的阈值百分比'
  },
  certExpiry: {
    label: '证书到期', kind: 'event', level: 'warn',
    threshold: 14, unit: '天', cooldownMinutes: 1440, sustainMs: 0,
    description: '证书剩余有效期不足阈值天数（≤7 天升级为严重）'
  },
  service: {
    label: '服务异常', kind: 'event', level: 'error',
    threshold: null, unit: '', cooldownMinutes: 30, sustainMs: 0,
    description: 'Nginx 未运行或配置校验失败、PM2 进程异常'
  },
  backup: {
    label: '备份失败', kind: 'event', level: 'error',
    threshold: null, unit: '', cooldownMinutes: 60, sustainMs: 0,
    description: '云备份最近一次同步失败'
  },
  cron: {
    label: '定时任务失败', kind: 'event', level: 'error',
    threshold: null, unit: '', cooldownMinutes: 60, sustainMs: 0,
    description: '计划任务执行返回非零退出码'
  }
};

let state = {};        // key -> { status, hitSince, missCount, lastSentAt, lastLevel, lastValue, lastSeen }
let history = [];      // 最新在前
let pending = [];      // { id, payload, channel, attempts, nextAt }
let timer = null;
let dirty = false;
let certCache = { at: 0, list: null };

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw;
  } catch (err) {
    logger.warn('Alerts', `${path.basename(file)} 无法解析，已重置：${err.message || err}`);
    return fallback;
  }
}

function saveJson(file, data) {
  try {
    ensureDir();
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    logger.warn('Alerts', `${path.basename(file)} 落盘失败：${err.message || err}`);
  }
}

function load() {
  state = loadJson(STATE_FILE, {}) || {};
  history = loadJson(HISTORY_FILE, []) || [];
  pending = loadJson(PENDING_FILE, []) || [];
  const cutoff = Date.now() - PENDING_TTL_MS;
  const before = pending.length;
  pending = pending.filter(p => (p.createdAt || 0) > cutoff);
  if (pending.length !== before) saveJson(PENDING_FILE, pending);
}

function saveState() {
  saveJson(STATE_FILE, state);
  dirty = false;
}

function pushHistory(entry) {
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  saveJson(HISTORY_FILE, history);
}

function effectiveRule(id) {
  const base = RULES[id];
  if (!base) return null;
  const overrides = notify.getAlertConfig().rules || {};
  const o = overrides[id] || {};
  const threshold = o.threshold !== undefined && o.threshold !== null && o.threshold !== ''
    ? Number(o.threshold)
    : base.threshold;
  const cooldownMinutes = o.cooldownMinutes !== undefined && o.cooldownMinutes !== null && o.cooldownMinutes !== ''
    ? Number(o.cooldownMinutes)
    : base.cooldownMinutes;

  return {
    id,
    label: base.label,
    kind: base.kind,
    level: base.level,
    unit: base.unit,
    description: base.description,
    enabled: o.enabled === undefined ? true : !!o.enabled,
    threshold,
    cooldownMinutes,
    cooldownMs: Math.max(60000, cooldownMinutes * 60000),
    sustainMs: base.sustainMs || 0
  };
}

function listRules() {
  return Object.keys(RULES).map(id => {
    const r = effectiveRule(id);
    return {
      id: r.id,
      label: r.label,
      kind: r.kind,
      enabled: r.enabled,
      threshold: r.threshold,
      unit: r.unit,
      cooldownMinutes: r.cooldownMinutes,
      description: r.description
    };
  });
}

function getState(key) {
  return state[key] || null;
}

function setState(key, patch) {
  state[key] = { ...(state[key] || {}), ...patch };
  dirty = true;
  return state[key];
}

async function deliver(rule, target, level, message, value) {
  const payload = {
    level,
    rule: rule.label,
    target,
    message,
    value,
    time: new Date().toLocaleString('zh-CN')
  };

  const { results, skipped } = await notify.send(payload);

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: new Date().toISOString(),
    ruleId: rule.id,
    rule: rule.label,
    target,
    level,
    message,
    value: value === undefined ? null : value,
    channels: results,
    skipped: !!skipped
  };
  pushHistory(entry);

  for (const r of results) {
    if (!r.ok) enqueue(payload, r.channel);
  }

  return entry;
}

function enqueue(payload, channel) {
  pending.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    payload,
    channel,
    attempts: 0,
    nextAt: Date.now() + PENDING_BACKOFF[0],
    createdAt: Date.now()
  });
  saveJson(PENDING_FILE, pending);
}

async function retryPending() {
  if (pending.length === 0) return;
  const now = Date.now();
  const due = pending.filter(p => (p.nextAt || 0) <= now);
  if (due.length === 0) return;

  for (const item of due) {
    const result = await notify.sendToChannel(item.channel, item.payload);
    if (result.ok) {
      pending = pending.filter(p => p.id !== item.id);
      pushHistory({
        id: `${item.id}-ok`,
        time: new Date().toISOString(),
        rule: item.payload.rule,
        target: item.payload.target,
        level: item.payload.level,
        message: item.payload.message,
        channels: [{ ...result, delayed: true }],
        skipped: false
      });
    } else {
      item.attempts += 1;
      if (item.attempts >= PENDING_MAX_ATTEMPTS) {
        pending = pending.filter(p => p.id !== item.id);
        pushHistory({
          id: `${item.id}-fail`,
          time: new Date().toISOString(),
          rule: item.payload.rule,
          target: item.payload.target,
          level: item.payload.level,
          message: item.payload.message,
          channels: [{ ...result, delayed: true, gaveUp: true }],
          skipped: false
        });
      } else {
        item.nextAt = Date.now() + PENDING_BACKOFF[Math.min(item.attempts, PENDING_BACKOFF.length - 1)];
      }
    }
  }
  saveJson(PENDING_FILE, pending);
}

// 纯决策函数：给定当前状态与本次采样，决定该做什么（不产生副作用，便于测试）
function decide(st, hit, level, rule, now) {
  if (hit) {
    if (!st || st.status !== 'firing') {
      const hitSince = st && st.hitSince ? st.hitSince : now;
      if (now - hitSince < (rule.sustainMs || 0)) {
        return {
          action: 'wait',
          next: { ...(st || {}), status: 'pending', hitSince, lastSeen: now }
        };
      }
      return {
        action: 'fire',
        next: {
          status: 'firing', hitSince, missCount: 0, lastSentAt: now,
          lastLevel: level, lastSeen: now
        }
      };
    }

    // 已在告警中：等级升高立即补发，否则等冷却结束再提醒
    const worse = LEVEL_WEIGHT[level] > LEVEL_WEIGHT[st.lastLevel || 'warn'];
    const cooled = now - (st.lastSentAt || 0) >= rule.cooldownMs;
    if (worse || cooled) {
      return {
        action: 'fire',
        next: { ...st, lastSentAt: now, lastLevel: level, lastSeen: now, missCount: 0 }
      };
    }
    return { action: 'silent', next: { ...st, lastSeen: now, missCount: 0 } };
  }

  if (!st) return { action: 'none', next: null };

  if (st.status === 'firing') {
    const missCount = (st.missCount || 0) + 1;
    if (missCount >= RECOVERY_MISS) {
      return {
        action: 'recover',
        next: { ...st, status: 'ok', missCount: 0, hitSince: null, lastSeen: now }
      };
    }
    return { action: 'silent', next: { ...st, missCount, lastSeen: now } };
  }

  if (st.status === 'pending') {
    return { action: 'none', next: { ...st, status: 'ok', missCount: 0, hitSince: null, lastSeen: now } };
  }

  return { action: 'none', next: { ...st, status: 'ok', missCount: 0, hitSince: null, lastSeen: now } };
}

// 统一的状态机：命中 → firing（冷却内静默）→ 连续未命中 → 恢复通知
async function applyCondition(rule, target, hit, level, message, value) {
  const key = `${rule.id}:${target}`;
  const now = Date.now();
  const decision = decide(getState(key), hit, level, rule, now);

  if (decision.next) {
    setState(key, { ...decision.next, lastValue: value });
  }

  if (decision.action === 'fire') {
    return deliver(rule, target, level, message, value);
  }
  if (decision.action === 'recover') {
    return deliver({ ...rule, level: 'info' }, target, 'info', `${rule.label} 已恢复正常`, value);
  }
  return null;
}

async function checkThresholdRules() {
  const latest = metrics.getLatest();
  const cores = (latest && latest.cores) || os.cpus().length || 1;

  const samples = [];
  if (latest) {
    samples.push({ id: 'disk', target: '/', value: latest.disk, unit: '%' });
    samples.push({ id: 'memory', target: 'host', value: latest.mem, unit: '%' });
  }
  const load1 = os.loadavg()[0];
  if (Number.isFinite(load1)) {
    samples.push({ id: 'load', target: 'host', value: Math.round((load1 / cores) * 100) / 100, unit: '×核数', raw: load1 });
  }
  const quota = traffic.getQuotaPercent();
  if (quota !== null && quota !== undefined) {
    samples.push({ id: 'trafficQuota', target: 'month', value: quota, unit: '%' });
  }

  for (const sample of samples) {
    const rule = effectiveRule(sample.id);
    if (!rule || !rule.enabled) continue;
    const hit = Number(sample.value) > Number(rule.threshold);
    const message = hit
      ? `${rule.label} ${sample.value}${rule.unit}，超过阈值 ${rule.threshold}${rule.unit}`
      : `${rule.label} 已回落到 ${sample.value}${rule.unit}`;
    await applyCondition(rule, sample.target, hit, rule.level, message, sample.value);
  }
}

function readCerts() {
  const now = Date.now();
  if (certCache.list && now - certCache.at < CERT_CACHE_MS) return certCache.list;
  let list = [];
  try {
    list = acme.listCerts() || [];
  } catch (err) {
    logger.warn('Alerts', '读取证书失败：' + (err.message || err));
  }
  certCache = { at: now, list };
  return list;
}

async function checkCertRule() {
  const rule = effectiveRule('certExpiry');
  if (!rule || !rule.enabled) return;

  const certs = readCerts();
  if (certs.length === 0) return;

  const seen = new Set();
  for (const cert of certs) {
    const expire = cert.expireDate ? new Date(cert.expireDate) : null;
    if (!expire || Number.isNaN(expire.getTime())) continue;
    const days = Math.ceil((expire.getTime() - Date.now()) / 86400000);
    const target = cert.domain;
    seen.add(target);

    const hit = days <= Number(rule.threshold);
    const level = days <= 7 ? 'error' : 'warn';
    const message = hit
      ? `证书剩余 ${days} 天（阈值 ${rule.threshold} 天）`
      : `证书剩余 ${days} 天`;
    await applyCondition(rule, target, hit, level, message, days);
  }

  // 已删除的证书把状态清掉，避免留下永远 firing 的孤儿键
  for (const key of Object.keys(state)) {
    if (!key.startsWith('certExpiry:')) continue;
    const domain = key.slice('certExpiry:'.length);
    if (!seen.has(domain)) delete state[key];
  }
}

async function checkServiceRule() {
  const rule = effectiveRule('service');
  if (!rule || !rule.enabled) return;

  let hit = false;
  let level = 'warn';
  let message = '';

  try {
    const data = await health.getHealth();
    const svc = (data.items || []).find(i => i.id === 'service');
    if (svc && (svc.status === 'error' || svc.status === 'warn')) {
      hit = true;
      level = svc.status === 'error' ? 'error' : 'warn';
      message = svc.detail;
    }
  } catch (err) {
    logger.warn('Alerts', '服务健康检查失败：' + (err.message || err));
    return;
  }

  await applyCondition(rule, 'host', hit, level, message || '服务运行正常', null);
}

async function checkBackupRule() {
  const rule = effectiveRule('backup');
  if (!rule || !rule.enabled) return;

  const cfg = config.load();
  const syncCfg = cfg.sync || {};
  if (!syncCfg.webdavUrl) return;

  const hit = syncCfg.lastStatus === 'fail';
  const message = hit
    ? `云备份最近一次同步失败（${new Date(syncCfg.lastSync || Date.now()).toLocaleString('zh-CN')}）`
    : '云备份已恢复正常';
  await applyCondition(rule, 'sync', hit, 'error', message, null);
}

// 一次性事件（定时任务失败等）：只告警，不做恢复判定
async function emit(ruleId, target, detail, level) {
  const rule = effectiveRule(ruleId);
  if (!rule || !rule.enabled) return null;

  const key = `${ruleId}:${target}`;
  const now = Date.now();
  const st = getState(key);
  if (st && st.status === 'firing' && now - (st.lastSentAt || 0) < rule.cooldownMs) {
    setState(key, { lastSeen: now, lastValue: detail });
    return null;
  }

  setState(key, { status: 'firing', hitSince: now, missCount: 0, lastSentAt: now, lastLevel: level || rule.level, lastValue: detail, lastSeen: now });
  return deliver(rule, target, level || rule.level, detail, null);
}

async function tick() {
  try {
    await checkThresholdRules();
    await checkCertRule();
    await checkServiceRule();
    await checkBackupRule();
    await retryPending();
  } catch (err) {
    logger.warn('Alerts', '规则评估失败：' + (err.message || err));
  }
  if (dirty) saveState();
}

function start() {
  if (timer) return;
  load();
  tick();
  timer = setInterval(tick, TICK_MS);
  if (timer.unref) timer.unref();
  logger.info('Alerts', `告警引擎已启动（${TICK_MS / 1000}s 评估周期）`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  saveState();
}

function getHistory(limit = 200) {
  return history.slice(0, limit);
}

function getStatus() {
  const firing = Object.entries(state)
    .filter(([, v]) => v.status === 'firing')
    .map(([key, v]) => ({ key, since: v.hitSince || null, level: v.lastLevel || 'warn', lastSeen: v.lastSeen || null }));
  return {
    rules: listRules(),
    firing,
    pending: pending.length,
    historyCount: history.length
  };
}

function clearCertCache() {
  certCache = { at: 0, list: null };
}

module.exports = {
  RULES,
  start,
  stop,
  tick,
  emit,
  load,
  getHistory,
  getStatus,
  listRules,
  clearCertCache,
  _test: { decide, LEVEL_WEIGHT, PENDING_BACKOFF, RECOVERY_MISS }
};
