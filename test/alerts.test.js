const alerts = require('../src/services/alerts');
const notify = require('../src/services/notify');

const { decide, RECOVERY_MISS } = alerts._test;

const RULE = {
  id: 'disk',
  label: '磁盘使用率',
  level: 'warn',
  threshold: 90,
  cooldownMs: 3600000,
  sustainMs: 0
};

describe('告警状态机', () => {
  const NOW = 1700000000000;

  it('首次命中立即触发', () => {
    const d = decide(undefined, true, 'warn', RULE, NOW);
    expect(d.action).toBe('fire');
    expect(d.next.status).toBe('firing');
    expect(d.next.lastSentAt).toBe(NOW);
    expect(d.next.hitSince).toBe(NOW);
  });

  it('冷却期内重复命中不重复发送', () => {
    const state = { status: 'firing', hitSince: NOW - 60000, lastSentAt: NOW - 60000, lastLevel: 'warn', missCount: 0 };
    const d = decide(state, true, 'warn', RULE, NOW);
    expect(d.action).toBe('silent');
    expect(d.next.lastSentAt).toBe(NOW - 60000);
  });

  it('冷却结束后仍异常则再次提醒', () => {
    const state = { status: 'firing', hitSince: NOW - 7200000, lastSentAt: NOW - 3700000, lastLevel: 'warn', missCount: 0 };
    const d = decide(state, true, 'warn', RULE, NOW);
    expect(d.action).toBe('fire');
    expect(d.next.lastSentAt).toBe(NOW);
  });

  it('等级升高时跳过冷却立即升级', () => {
    const state = { status: 'firing', hitSince: NOW - 60000, lastSentAt: NOW - 60000, lastLevel: 'warn', missCount: 0 };
    const d = decide(state, true, 'error', RULE, NOW);
    expect(d.action).toBe('fire');
    expect(d.next.lastLevel).toBe('error');
  });

  it('持续时长未满足时等待，满足后触发', () => {
    const slow = { ...RULE, id: 'memory', sustainMs: 300000 };

    const first = decide(undefined, true, 'warn', slow, NOW);
    expect(first.action).toBe('wait');
    expect(first.next.status).toBe('pending');

    const early = decide(first.next, true, 'warn', slow, NOW + 60000);
    expect(early.action).toBe('wait');

    const due = decide(early.next, true, 'warn', slow, NOW + 310000);
    expect(due.action).toBe('fire');
  });

  it('恢复需要连续多个周期未命中', () => {
    let state = { status: 'firing', hitSince: NOW - 60000, lastSentAt: NOW - 60000, lastLevel: 'warn', missCount: 0 };

    for (let i = 1; i < RECOVERY_MISS; i++) {
      const d = decide(state, false, 'warn', RULE, NOW + i * 5000);
      expect(d.action).toBe('silent');
      state = d.next;
    }

    const recovered = decide(state, false, 'warn', RULE, NOW + RECOVERY_MISS * 5000);
    expect(recovered.action).toBe('recover');
    expect(recovered.next.status).toBe('ok');
  });

  it('波动一次不会误报恢复', () => {
    const state = { status: 'firing', hitSince: NOW - 60000, lastSentAt: NOW - 60000, lastLevel: 'warn', missCount: 0 };
    const miss = decide(state, false, 'warn', RULE, NOW);
    expect(miss.action).toBe('silent');

    const back = decide(miss.next, true, 'warn', RULE, NOW + 5000);
    expect(back.action).toBe('silent');
    expect(back.next.missCount).toBe(0);
  });

  it('从未命中过则不产生任何动作', () => {
    const d = decide(undefined, false, 'warn', RULE, NOW);
    expect(d.action).toBe('none');
    expect(d.next).toBeNull();
  });
});

describe('通知消息渲染', () => {
  it('JSON 模板会转义引号与换行', () => {
    const out = notify.renderTemplate('{"c":"{{message}}"}', { message: '有"引号"\n换行' }, 'json');
    expect(out).toBe('{"c":"有\\"引号\\"\\n换行"}');
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('表单与 URL 模板会做 URL 编码', () => {
    expect(notify.renderTemplate('title={{title}}', { title: '磁盘 90%' }, 'form')).toBe('title=%E7%A3%81%E7%9B%98%2090%25');
    expect(notify.renderTemplate('https://x/{{title}}', { title: 'a b' }, 'url')).toBe('https://x/a%20b');
  });

  it('纯文本模板原样替换', () => {
    expect(notify.renderTemplate('{{title}} - {{message}}', { title: 'T', message: 'M' }, 'text')).toBe('T - M');
  });

  it('未知变量替换为空字符串', () => {
    expect(notify.renderTemplate('a{{nope}}b', {}, 'text')).toBe('ab');
  });

  it('消息包含级别与目标', () => {
    const { title, text } = notify.buildMessage({
      level: 'error',
      rule: '备份失败',
      target: 'sync',
      message: 'WebDAV 连接失败',
      time: '2026-11-09 12:00'
    });
    expect(title).toContain('ERROR');
    expect(text).toContain('备份失败');
    expect(text).toContain('sync');
    expect(text).toContain('WebDAV 连接失败');
  });

  it('Webhook 地址提示不泄漏 query 中的密钥', () => {
    expect(notify._test.safeUrlHint('https://api.day.app/SECRET123/标题')).toBe('https://api.day.app');
  });
});
