const ports = require('../src/services/ports');

const {
  parseSsOutput,
  parsePsOutput,
  extractListenPorts,
  splitAddress,
  expandUfwPorts,
  assertKillable
} = ports._test;

describe('ss 输出解析', () => {
  it('解析单进程监听', () => {
    const output = 'tcp   LISTEN 0      511          0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=1234,fd=6))';
    const rows = parseSsOutput(output);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      netid: 'tcp',
      protocol: 'tcp',
      state: 'LISTEN',
      address: '0.0.0.0',
      port: 80
    });
    expect(rows[0].processes).toEqual([{ name: 'nginx', pid: 1234 }]);
  });

  it('一个端口对应多个进程时全部保留', () => {
    const output = 'tcp   LISTEN 0      511          0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=1234,fd=6),("nginx",pid=1235,fd=6))';
    const rows = parseSsOutput(output);
    expect(rows[0].processes).toHaveLength(2);
    expect(rows[0].processes.map(p => p.pid)).toEqual([1234, 1235]);
  });

  it('缺少进程信息时进程列表为空', () => {
    const output = 'tcp   LISTEN 0      128          0.0.0.0:8080       0.0.0.0:*';
    const rows = parseSsOutput(output);
    expect(rows).toHaveLength(1);
    expect(rows[0].processes).toEqual([]);
  });

  it('解析 UDP 与 IPv6 监听', () => {
    const output = [
      'udp   UNCONN 0      0            0.0.0.0:68         0.0.0.0:*    users:(("dhclient",pid=88,fd=6))',
      'tcp6  LISTEN 0      511                 *:443              *:*    users:(("nginx",pid=1234,fd=7))'
    ].join('\n');
    const rows = parseSsOutput(output);
    expect(rows).toHaveLength(2);
    expect(rows[0].protocol).toBe('udp');
    expect(rows[0].port).toBe(68);
    expect(rows[1].port).toBe(443);
  });

  it('忽略表头与空行', () => {
    const output = ['State Recv-Q Send-Q Local Peer', '', 'tcp LISTEN 0 511 0.0.0.0:22 0.0.0.0:*'].join('\n');
    const rows = parseSsOutput(output);
    expect(rows.length).toBe(1);
  });
});

describe('地址与端口解析', () => {
  it('拆分 IPv4 与 IPv6 地址', () => {
    expect(splitAddress('0.0.0.0:80')).toEqual({ address: '0.0.0.0', port: 80 });
    expect(splitAddress('[::]:443')).toEqual({ address: '[::]', port: 443 });
    expect(splitAddress('*:443')).toEqual({ address: '*', port: 443 });
    expect(splitAddress('0.0.0.0:*')).toEqual({ address: '0.0.0.0', port: null });
  });

  it('从 nginx listen 指令提取端口', () => {
    expect(extractListenPorts('80')).toEqual([80]);
    expect(extractListenPorts('443 ssl')).toEqual([443]);
    expect(extractListenPorts('0.0.0.0:8080 default_server')).toEqual([8080]);
    expect(extractListenPorts('[::]:443 ssl')).toEqual([443]);
  });

  it('展开 ufw 端口规则', () => {
    expect(expandUfwPorts('80,443')).toEqual([80, 443]);
    expect(expandUfwPorts('8000-8002')).toEqual([8000, 8001, 8002]);
    expect(expandUfwPorts('Anywhere')).toEqual(['*']);
  });
});

describe('ps 输出解析', () => {
  it('解析进程行并换算内存单位', () => {
    const output = [
      '  PID  PPID USER     %CPU %MEM   RSS     ELAPSED COMMAND',
      '  123     1 root      12.5  3.2 102400       01:02:03 node app.js --flag'
    ].join('\n');
    const list = parsePsOutput(output, 10);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      pid: 123,
      ppid: 1,
      user: 'root',
      cpu: 12.5,
      memPercent: 3.2,
      rss: 102400 * 1024,
      elapsed: '01:02:03',
      command: 'node app.js --flag'
    });
  });

  it('按 limit 截断', () => {
    const output = ['PID PPID', '1 0 root 0 0 100 1 a', '2 0 root 0 0 100 1 b', '3 0 root 0 0 100 1 c'].join('\n');
    expect(parsePsOutput(output, 2)).toHaveLength(2);
  });
});

describe('终止保护', () => {
  it('拒绝终止 pid 1', () => {
    expect(() => assertKillable(1)).toThrow(/不允许/);
  });

  it('拒绝终止面板自身进程', () => {
    expect(() => assertKillable(process.pid)).toThrow(/不允许/);
  });

  it('非法 pid 被拒绝', () => {
    expect(() => assertKillable(0)).toThrow(/不合法/);
    expect(() => assertKillable('abc')).toThrow(/不合法/);
    expect(() => assertKillable(-5)).toThrow(/不合法/);
  });

  it('普通 pid 通过校验', () => {
    expect(assertKillable(999999)).toBe(999999);
  });
});
