const fs = require('fs');
const path = require('path');
const cron = require('../src/services/cron');

const TEST_ID = 'unittestcron';

describe('parseCrontab', () => {
  it('解析面板管理的启用任务', () => {
    const content = ['# worm:abc123:清理日志', '0 3 * * * find /tmp -mtime +7 -delete', ''].join('\n');
    const jobs = cron.parseCrontab(content);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: 'abc123',
      name: '清理日志',
      schedule: '0 3 * * *',
      command: 'find /tmp -mtime +7 -delete',
      enabled: true,
      managed: true
    });
  });

  it('把被注释的 cron 行识别为已禁用', () => {
    const content = ['# worm:def456:备份', '# 0 4 * * * tar -czf /tmp/a.tgz /data'].join('\n');
    const jobs = cron.parseCrontab(content);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: 'def456', name: '备份', enabled: false, managed: true });
    expect(jobs[0].command).toBe('tar -czf /tmp/a.tgz /data');
  });

  it('解析非面板管理的任务', () => {
    const content = ['30 2 * * * /usr/local/bin/backup.sh', ''].join('\n');
    const jobs = cron.parseCrontab(content);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: null, managed: false, enabled: true });
    expect(jobs[0].schedule).toBe('30 2 * * *');
  });

  it('忽略空行、纯注释行与环境变量行', () => {
    const content = ['', '# 这是注释', 'PATH=/usr/bin:/bin', 'SHELL=/bin/bash', ''].join('\n');
    expect(cron.parseCrontab(content)).toEqual([]);
  });

  it('空内容返回空数组', () => {
    expect(cron.parseCrontab('')).toEqual([]);
  });
});

describe('parseCronLine', () => {
  it('含 shell 元字符的命令保持逐字不变', () => {
    const line = '0 3 * * * echo "$(date)" `id` ; ls -la';
    const parsed = cron.parseCronLine(line);

    expect(parsed.schedule).toBe('0 3 * * *');
    expect(parsed.command).toBe('echo "$(date)" `id` ; ls -la');
  });

  it('字段不足时返回 null', () => {
    expect(cron.parseCronLine('not a cron line')).toBeNull();
    expect(cron.parseCronLine('* * * *')).toBeNull();
  });
});

describe('执行历史截断', () => {
  const histFile = path.join(__dirname, '..', 'data', 'cron-history', `${TEST_ID}.jsonl`);

  afterAll(() => {
    try {
      fs.unlinkSync(histFile);
    } catch (e) {
      // 文件不存在即可
    }
  });

  it('超过上限时只保留最近 50 条且按时间倒序返回', () => {
    for (let i = 0; i < 55; i += 1) {
      cron.appendHistory(TEST_ID, {
        time: new Date(i * 1000).toISOString(),
        exitCode: 0,
        stdout: `record-${i}`,
        stderr: '',
        duration: i
      });
    }

    const history = cron.getHistory(TEST_ID);
    expect(history).toHaveLength(50);
    expect(history[0].stdout).toBe('record-54');
    expect(history[49].stdout).toBe('record-5');
  });
});
