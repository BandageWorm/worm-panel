const traffic = require('../src/services/traffic');

const { periodKey, periodStart, diffCounters, dayKey, clampResetDay } = traffic._test;

describe('计费周期', () => {
  it('重置日为 1 时按自然月切分', () => {
    expect(periodKey(new Date(2026, 10, 9), 1)).toBe('2026-11-01');
    expect(periodKey(new Date(2026, 10, 1), 1)).toBe('2026-11-01');
  });

  it('重置日在月底时，日期小于重置日归到上个月', () => {
    expect(periodKey(new Date(2026, 10, 9), 15)).toBe('2026-10-15');
    expect(periodKey(new Date(2026, 10, 15), 15)).toBe('2026-11-15');
    expect(periodKey(new Date(2026, 10, 25), 15)).toBe('2026-11-15');
  });

  it('跨年时正确回退到上一年', () => {
    expect(periodKey(new Date(2026, 0, 3), 15)).toBe('2025-12-15');
  });

  it('周期起点是当天零点', () => {
    const start = periodStart(new Date(2026, 10, 20, 18, 30), 15);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(10);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it('重置日被限制在 1-28', () => {
    expect(clampResetDay(0)).toBe(1);
    expect(clampResetDay(31)).toBe(28);
    expect(clampResetDay('abc')).toBe(1);
    expect(clampResetDay(15)).toBe(15);
  });
});

describe('计数器差值', () => {
  it('首次读取只建立基线，不产生增量', () => {
    const state = { counters: {} };
    const result = diffCounters(state, 'eth0', { rx: 1000, tx: 500 });
    expect(result.delta).toEqual({ rx: 0, tx: 0 });
    expect(result.reset).toBe(false);
    expect(state.counters.eth0).toEqual({ rx: 1000, tx: 500 });
  });

  it('正常增长时返回增量', () => {
    const state = { counters: { eth0: { rx: 1000, tx: 500 } } };
    const result = diffCounters(state, 'eth0', { rx: 1600, tx: 900 });
    expect(result.delta).toEqual({ rx: 600, tx: 400 });
    expect(result.reset).toBe(false);
    expect(state.counters.eth0).toEqual({ rx: 1600, tx: 900 });
  });

  it('计数器变小视为主机重启，本次不计增量', () => {
    const state = { counters: { eth0: { rx: 900000, tx: 800000 } } };
    const result = diffCounters(state, 'eth0', { rx: 200, tx: 100 });
    expect(result.delta).toEqual({ rx: 0, tx: 0 });
    expect(result.reset).toBe(true);
    expect(state.counters.eth0).toEqual({ rx: 200, tx: 100 });
  });

  it('读取失败（null）不影响已有基线', () => {
    const state = { counters: { eth0: { rx: 1000, tx: 500 } } };
    const result = diffCounters(state, 'eth0', null);
    expect(result.delta).toEqual({ rx: 0, tx: 0 });
    expect(state.counters.eth0).toEqual({ rx: 1000, tx: 500 });
  });

  it('多网卡各自独立累计', () => {
    const state = { counters: {} };
    diffCounters(state, 'eth0', { rx: 100, tx: 50 });
    diffCounters(state, 'eth1', { rx: 900, tx: 700 });
    expect(diffCounters(state, 'eth0', { rx: 300, tx: 150 }).delta).toEqual({ rx: 200, tx: 100 });
    expect(diffCounters(state, 'eth1', { rx: 1000, tx: 800 }).delta).toEqual({ rx: 100, tx: 100 });
  });
});

describe('日期键', () => {
  it('格式为 YYYY-MM-DD 且补零', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
