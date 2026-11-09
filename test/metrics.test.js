const metrics = require('../src/services/metrics');

const { downsample, resolveRange, retentionMax, MAX_POINTS } = metrics._test;

describe('指标区间', () => {
  it('识别支持的区间', () => {
    expect(resolveRange('1h')).toBe(3600000);
    expect(resolveRange('24h')).toBe(86400000);
    expect(resolveRange('7d')).toBe(604800000);
  });

  it('拒绝未知区间', () => {
    expect(resolveRange('30d')).toBeNull();
    expect(resolveRange('')).toBeNull();
    expect(resolveRange(undefined)).toBeNull();
  });

  it('查询未知区间返回 null（路由据此回 400）', () => {
    expect(metrics.query('30d')).toBeNull();
  });

  it('保留天数落在 1-30 之间', () => {
    const days = retentionMax();
    expect(days).toBeGreaterThanOrEqual(1440);
    expect(days).toBeLessThanOrEqual(43200);
  });
});

describe('序列抽稀', () => {
  const makePoints = (n) => Array.from({ length: n }, (_, i) => ({
    t: 1000 + i * 5000,
    cpu: i % 100,
    mem: 50,
    disk: 40,
    rxSpeed: 1024,
    txSpeed: 2048
  }));

  it('不足上限时原样返回', () => {
    const points = makePoints(10);
    expect(downsample(points)).toHaveLength(10);
  });

  it('超过上限时压缩到上限以内', () => {
    const points = makePoints(5000);
    const result = downsample(points);
    expect(result.length).toBeLessThanOrEqual(MAX_POINTS);
    expect(result.length).toBeGreaterThan(0);
  });

  it('压缩后保留时间戳单调递增', () => {
    const result = downsample(makePoints(2000));
    for (let i = 1; i < result.length; i++) {
      expect(result[i].t).toBeGreaterThan(result[i - 1].t);
    }
  });

  it('压缩使用平均值而非取样点', () => {
    const points = [
      { t: 1, cpu: 0, mem: 0, disk: 0, rxSpeed: 0, txSpeed: 0 },
      { t: 2, cpu: 100, mem: 100, disk: 100, rxSpeed: 200, txSpeed: 400 }
    ];
    const result = downsample(points, 1);
    expect(result).toHaveLength(1);
    expect(result[0].cpu).toBe(50);
    expect(result[0].rxSpeed).toBe(100);
  });

  it('空输入不报错', () => {
    expect(downsample([])).toEqual([]);
    expect(downsample(null)).toEqual([]);
  });
});
