const config = require('./config');
const logger = require('../utils/logger');

const TIMEOUT_MS = 10000;
const CHANNELS = ['telegram', 'email', 'webhook'];

const PRESETS = {
  bark: {
    label: 'Bark',
    url: 'https://api.day.app/{{key}}/{{title}}/{{message}}',
    method: 'GET',
    contentType: 'url',
    body: ''
  },
  serverchan: {
    label: 'Server 酱',
    url: 'https://sctapi.ftqq.com/{{key}}.send',
    method: 'POST',
    contentType: 'form',
    body: 'title={{title}}&desp={{message}}'
  },
  wecom: {
    label: '企业微信机器人',
    url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={{key}}',
    method: 'POST',
    contentType: 'json',
    body: '{"msgtype":"text","text":{"content":"{{message}}"}}'
  },
  dingtalk: {
    label: '钉钉机器人',
    url: 'https://oapi.dingtalk.com/robot/send?access_token={{key}}',
    method: 'POST',
    contentType: 'json',
    body: '{"msgtype":"text","text":{"content":"{{message}}"}}'
  }
};

const DEFAULT_CHANNEL = {
  telegram: { enabled: false, botToken: '', chatId: '', apiBase: '' },
  email: { enabled: false, host: '', port: 465, user: '', pass: '', from: '', to: [], allowInsecure: false },
  webhook: { enabled: false, url: '', method: 'POST', contentType: 'json', headers: {}, body: '' }
};

function mergeChannel(name, raw) {
  const base = DEFAULT_CHANNEL[name];
  if (!raw || typeof raw !== 'object') return { ...base };
  return { ...base, ...raw };
}

function getAlertConfig(cfg) {
  const source = (cfg || config.load()).alerts || {};
  return {
    telegram: mergeChannel('telegram', source.telegram),
    email: {
      ...mergeChannel('email', source.email),
      to: Array.isArray(source.email?.to) ? source.email.to : []
    },
    webhook: {
      ...mergeChannel('webhook', source.webhook),
      headers: source.webhook?.headers && typeof source.webhook.headers === 'object' ? source.webhook.headers : {}
    },
    rules: source.rules && typeof source.rules === 'object' ? source.rules : {}
  };
}

function isConfigured(name, channel) {
  if (!channel) return false;
  if (name === 'telegram') return !!(channel.botToken && channel.chatId);
  if (name === 'email') return !!(channel.host && channel.pass && channel.from && channel.to && channel.to.length > 0);
  if (name === 'webhook') return !!channel.url;
  return false;
}

// 接口只回脱敏视图：凭据永远不回显
function maskConfig(cfg) {
  const alerts = getAlertConfig(cfg);
  return {
    telegram: {
      enabled: alerts.telegram.enabled,
      chatId: alerts.telegram.chatId || '',
      apiBase: alerts.telegram.apiBase || '',
      configured: isConfigured('telegram', alerts.telegram)
    },
    email: {
      enabled: alerts.email.enabled,
      host: alerts.email.host || '',
      port: alerts.email.port,
      user: alerts.email.user || '',
      from: alerts.email.from || '',
      to: alerts.email.to || [],
      allowInsecure: !!alerts.email.allowInsecure,
      configured: isConfigured('email', alerts.email)
    },
    webhook: {
      enabled: alerts.webhook.enabled,
      method: alerts.webhook.method || 'POST',
      contentType: alerts.webhook.contentType || 'json',
      body: alerts.webhook.body || '',
      headers: alerts.webhook.headers || {},
      // 只暴露域名，避免泄漏 query 里的密钥
      urlHint: safeUrlHint(alerts.webhook.url),
      configured: isConfigured('webhook', alerts.webhook)
    },
    presets: Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, url: p.url, method: p.method, contentType: p.contentType, body: p.body }))
  };
}

function safeUrlHint(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '已配置';
  }
}

function escapeFor(contentType, value) {
  const text = value === undefined || value === null ? '' : String(value);
  if (contentType === 'json') {
    return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
  if (contentType === 'form') return encodeURIComponent(text);
  if (contentType === 'url') return encodeURIComponent(text);
  return text;
}

function renderTemplate(template, vars, contentType) {
  if (!template) return '';
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => escapeFor(contentType, vars[key]));
}

function buildMessage(payload) {
  const level = String(payload.level || 'warn').toUpperCase();
  const title = `[worm-panel][${level}] ${payload.rule || '告警'}`;
  const lines = [
    title,
    payload.target ? `目标：${payload.target}` : null,
    `详情：${payload.message || ''}`,
    `时间：${payload.time || new Date().toLocaleString('zh-CN')}`
  ].filter(Boolean);
  return { title, text: lines.join('\n') };
}

async function withTimeout(fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegram(channel, payload) {
  const base = (channel.apiBase || 'https://api.telegram.org').replace(/\/+$/, '');
  const url = `${base}/bot${channel.botToken}/sendMessage`;
  const { text } = buildMessage(payload);

  const res = await withTimeout(signal => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: channel.chatId, text, disable_web_page_preview: true }),
    signal
  }));

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram 返回 ${res.status} ${body.slice(0, 200)}`);
  }
  return true;
}

async function sendEmail(channel, payload) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    throw new Error('未安装 nodemailer，请重新执行 npm install');
  }

  const { title, text } = buildMessage(payload);
  const transporter = nodemailer.createTransport({
    host: channel.host,
    port: Number(channel.port) || 465,
    secure: Number(channel.port) === 465,
    auth: channel.user ? { user: channel.user, pass: channel.pass } : undefined,
    tls: { rejectUnauthorized: !channel.allowInsecure },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS
  });

  await transporter.sendMail({
    from: channel.from || channel.user,
    to: (channel.to || []).join(','),
    subject: title,
    text
  });
  return true;
}

async function sendWebhook(channel, payload) {
  const { title, text } = buildMessage(payload);
  const vars = {
    title,
    message: text,
    level: payload.level || 'warn',
    rule: payload.rule || '',
    target: payload.target || '',
    value: payload.value === undefined || payload.value === null ? '' : payload.value,
    time: payload.time || new Date().toISOString()
  };

  const contentType = channel.contentType || 'json';
  const method = (channel.method || 'POST').toUpperCase();
  const url = renderTemplate(channel.url, vars, 'url');
  const body = renderTemplate(channel.body, vars, contentType);

  const headers = { ...(channel.headers || {}) };
  if (contentType === 'json' && !Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  } else if (contentType === 'form' && !Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (contentType === 'text' && !Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'text/plain; charset=utf-8';
  }

  const init = { method, headers, redirect: 'manual' };
  if (method !== 'GET' && method !== 'HEAD' && body) init.body = body;

  const res = await withTimeout(signal => fetch(url, { ...init, signal }));
  if (res.status < 200 || res.status >= 300) {
    const respBody = await res.text().catch(() => '');
    throw new Error(`Webhook 返回 ${res.status} ${respBody.slice(0, 200)}`);
  }
  return true;
}

const SENDERS = {
  telegram: sendTelegram,
  email: sendEmail,
  webhook: sendWebhook
};

function enabledChannels(cfg) {
  const alerts = getAlertConfig(cfg);
  return CHANNELS.filter(name => alerts[name].enabled && isConfigured(name, alerts[name]));
}

async function sendToChannel(name, payload, cfg) {
  const alerts = getAlertConfig(cfg);
  const channel = alerts[name];
  const started = Date.now();
  try {
    await SENDERS[name](channel, payload);
    return { channel: name, ok: true, ms: Date.now() - started };
  } catch (err) {
    logger.warn('Notify', `${name} 投递失败：${err.message || err}`);
    return { channel: name, ok: false, ms: Date.now() - started, error: err.message || String(err) };
  }
}

// 单通道发送：失败后即时重试一次
async function sendToChannelWithRetry(name, payload, cfg) {
  const first = await sendToChannel(name, payload, cfg);
  if (first.ok) return first;

  await new Promise(resolve => setTimeout(resolve, 1000));
  const second = await sendToChannel(name, payload, cfg);
  return second.ok ? { ...second, retried: true } : { ...second, retried: true };
}

async function send(payload, cfg) {
  const names = enabledChannels(cfg);
  if (names.length === 0) {
    return { results: [], skipped: true };
  }
  const results = await Promise.all(names.map(name => sendToChannelWithRetry(name, payload, cfg)));
  return { results, skipped: false };
}

async function sendTest(name) {
  const cfg = config.load();
  const alerts = getAlertConfig(cfg);
  if (!CHANNELS.includes(name)) throw new Error('未知的通知通道');
  if (!isConfigured(name, alerts[name])) throw new Error('该通道尚未完成配置');

  const payload = {
    level: 'info',
    rule: '测试消息',
    target: 'worm-panel',
    message: '这是一条来自 Worm Panel 的测试消息，收到说明通道配置正确。',
    time: new Date().toLocaleString('zh-CN')
  };
  const result = await sendToChannel(name, payload, cfg);
  return result;
}

module.exports = {
  CHANNELS,
  PRESETS,
  getAlertConfig,
  maskConfig,
  isConfigured,
  enabledChannels,
  renderTemplate,
  buildMessage,
  send,
  sendToChannel,
  sendToChannelWithRetry,
  sendTest,
  _test: { escapeFor, safeUrlHint, mergeChannel }
};
