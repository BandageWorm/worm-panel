const { Router } = require('express');
const config = require('../services/config');
const notify = require('../services/notify');
const alerts = require('../services/alerts');
const logger = require('../utils/logger');

const router = Router();

const EMAIL_PORTS = [465, 587];
const WEBHOOK_METHODS = ['GET', 'POST', 'PUT'];
const CONTENT_TYPES = ['json', 'form', 'text'];

function asString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function asBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeRecipients(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[,;\s]+/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function buildChannels(current, input) {
  const errors = [];
  const next = {
    telegram: { ...current.telegram },
    email: { ...current.email, to: [...(current.email.to || [])] },
    webhook: { ...current.webhook, headers: { ...(current.webhook.headers || {}) } },
    rules: current.rules || {}
  };

  if (input.telegram) {
    const t = input.telegram;
    next.telegram = {
      enabled: asBool(t.enabled, current.telegram.enabled),
      // 凭据留空表示沿用旧值
      botToken: t.botToken ? asString(t.botToken) : current.telegram.botToken,
      chatId: t.chatId !== undefined ? asString(t.chatId) : current.telegram.chatId,
      apiBase: t.apiBase !== undefined ? asString(t.apiBase) : current.telegram.apiBase
    };
    if (next.telegram.apiBase && !/^https?:\/\//i.test(next.telegram.apiBase)) {
      errors.push('Telegram API 地址必须以 http:// 或 https:// 开头');
    }
    if (next.telegram.enabled) {
      if (!next.telegram.botToken) errors.push('启用 Telegram 需要填写 Bot Token');
      if (!next.telegram.chatId) errors.push('启用 Telegram 需要填写 Chat ID');
    }
  }

  if (input.email) {
    const e = input.email;
    const port = e.port !== undefined ? Number(e.port) : Number(current.email.port);
    next.email = {
      enabled: asBool(e.enabled, current.email.enabled),
      host: e.host !== undefined ? asString(e.host) : current.email.host,
      port: Number.isFinite(port) ? port : 465,
      user: e.user !== undefined ? asString(e.user) : current.email.user,
      pass: e.pass ? String(e.pass) : current.email.pass,
      from: e.from !== undefined ? asString(e.from) : current.email.from,
      to: e.to !== undefined ? normalizeRecipients(e.to) : current.email.to,
      allowInsecure: asBool(e.allowInsecure, current.email.allowInsecure)
    };
    if (!EMAIL_PORTS.includes(next.email.port)) {
      errors.push('邮件端口只支持 465（SSL）或 587（STARTTLS），25 端口通常被云厂商封禁');
    }
    if (next.email.enabled) {
      if (!next.email.host) errors.push('启用邮件通道需要填写 SMTP 服务器');
      if (!next.email.from) errors.push('启用邮件通道需要填写发件人');
      if (!next.email.pass) errors.push('启用邮件通道需要填写 SMTP 密码或授权码');
      if (next.email.to.length === 0) errors.push('启用邮件通道需要至少一个收件人');
    }
  }

  if (input.webhook) {
    const w = input.webhook;
    const method = asString(w.method, current.webhook.method || 'POST').toUpperCase();
    const contentType = asString(w.contentType, current.webhook.contentType || 'json').toLowerCase();
    next.webhook = {
      enabled: asBool(w.enabled, current.webhook.enabled),
      url: w.url !== undefined ? asString(w.url) : current.webhook.url,
      method,
      contentType,
      body: w.body !== undefined ? String(w.body) : current.webhook.body,
      headers: w.headers && typeof w.headers === 'object' ? w.headers : current.webhook.headers
    };
    if (!WEBHOOK_METHODS.includes(next.webhook.method)) {
      errors.push('Webhook 请求方法只支持 GET / POST / PUT');
    }
    if (!CONTENT_TYPES.includes(next.webhook.contentType)) {
      errors.push('Webhook 内容类型只支持 json / form / text');
    }
    if (next.webhook.url && !/^https?:\/\//i.test(next.webhook.url)) {
      errors.push('Webhook 地址必须以 http:// 或 https:// 开头');
    }
    if (next.webhook.enabled && !next.webhook.url) {
      errors.push('启用 Webhook 需要填写地址');
    }
  }

  return { next, errors };
}

function buildRules(current, input) {
  const errors = [];
  const next = { ...(current || {}) };

  for (const [id, patch] of Object.entries(input || {})) {
    if (!alerts.RULES[id]) {
      errors.push(`未知的告警规则：${id}`);
      continue;
    }
    const merged = { ...(next[id] || {}) };

    if (patch.enabled !== undefined) merged.enabled = asBool(patch.enabled, true);

    if (patch.threshold !== undefined && patch.threshold !== null && patch.threshold !== '') {
      const value = Number(patch.threshold);
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`${alerts.RULES[id].label}的阈值必须是不小于 0 的数字`);
      } else {
        merged.threshold = value;
      }
    }

    if (patch.cooldownMinutes !== undefined && patch.cooldownMinutes !== null && patch.cooldownMinutes !== '') {
      const value = Number(patch.cooldownMinutes);
      if (!Number.isInteger(value) || value < 1 || value > 10080) {
        errors.push(`${alerts.RULES[id].label}的冷却期必须是 1-10080 之间的整数分钟`);
      } else {
        merged.cooldownMinutes = value;
      }
    }

    next[id] = merged;
  }

  return { next, errors };
}

// GET /api/alerts —— 脱敏配置 + 规则 + 运行状态 + 最近历史
router.get('/', (req, res) => {
  const cfg = config.load();
  res.json({
    channels: notify.maskConfig(cfg),
    enabledChannels: notify.enabledChannels(cfg),
    rules: alerts.listRules(),
    status: alerts.getStatus(),
    history: alerts.getHistory(100)
  });
});

// GET /api/alerts/history
router.get('/history', (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
  res.json({ history: alerts.getHistory(limit) });
});

// PUT /api/alerts/channels —— 保存通道配置（凭据留空 = 不修改）
router.put('/channels', (req, res) => {
  try {
    const cfg = config.load();
    const current = notify.getAlertConfig(cfg);
    const { next, errors } = buildChannels(current, req.body || {});
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('；') });
    }
    cfg.alerts = next;
    config.save(cfg);
    res.json({ success: true, channels: notify.maskConfig(cfg) });
  } catch (err) {
    logger.error('Alerts', '保存通道配置失败', err);
    res.status(500).json({ error: err.message || '保存失败' });
  }
});

// PUT /api/alerts/rules —— 保存规则阈值/开关
router.put('/rules', (req, res) => {
  try {
    const cfg = config.load();
    const current = notify.getAlertConfig(cfg).rules;
    const { next, errors } = buildRules(current, req.body || {});
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('；') });
    }
    const channelCfg = notify.getAlertConfig(cfg);
    cfg.alerts = { ...channelCfg, rules: next };
    config.save(cfg);
    res.json({ success: true, rules: alerts.listRules() });
  } catch (err) {
    logger.error('Alerts', '保存规则失败', err);
    res.status(500).json({ error: err.message || '保存失败' });
  }
});

// POST /api/alerts/test —— 单通道测试发送
router.post('/test', async (req, res) => {
  try {
    const channel = String((req.body || {}).channel || '');
    const result = await notify.sendTest(channel);
    if (!result.ok) {
      return res.status(400).json({ error: result.error || '发送失败', ms: result.ms });
    }
    res.json({ success: true, ms: result.ms });
  } catch (err) {
    res.status(400).json({ error: err.message || '发送失败' });
  }
});

// POST /api/alerts/check —— 立即评估一次（便于排查规则）
router.post('/check', async (req, res) => {
  try {
    await alerts.tick();
    res.json({ success: true, status: alerts.getStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message || '评估失败' });
  }
});

module.exports = router;
