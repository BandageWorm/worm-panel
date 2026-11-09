const fs = require('fs');
const os = require('os');
const path = require('path');
const logs = require('../src/services/logs');

const { encodeFileId, decodeFileId, isInsideRoots, applyFilter, normalizeLines } = logs._test;

describe('日志文件标识', () => {
  it('编码后可还原原始路径', () => {
    const target = '/var/log/nginx/access.log';
    expect(decodeFileId(encodeFileId(target))).toBe(target);
  });

  it('中文路径也能还原', () => {
    const target = '/var/log/日志/访问.log';
    expect(decodeFileId(encodeFileId(target))).toBe(target);
  });
});

describe('路径白名单', () => {
  let tmpRoot;
  let outside;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worm-log-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'worm-out-'));
    fs.writeFileSync(path.join(tmpRoot, 'access.log'), 'line1\n');
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret\n');
  });

  afterAll(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(outside, { recursive: true, force: true }); } catch {}
  });

  it('允许根目录内的文件', () => {
    expect(isInsideRoots(path.join(tmpRoot, 'access.log'), [tmpRoot])).toBe(true);
  });

  it('拒绝根目录外的文件', () => {
    expect(isInsideRoots(path.join(outside, 'secret.txt'), [tmpRoot])).toBe(false);
  });

  it('拒绝通过 ../ 越界', () => {
    const escape = path.join(tmpRoot, '..', path.basename(outside), 'secret.txt');
    expect(isInsideRoots(escape, [tmpRoot])).toBe(false);
  });

  it('不存在的根目录直接判定为否', () => {
    expect(isInsideRoots(path.join(tmpRoot, 'access.log'), ['/no/such/dir'])).toBe(false);
  });
});

describe('日志过滤', () => {
  const lines = ['GET /index.html 200', 'POST /api/login 401', 'error: connection refused', ''];

  it('无关键字时去掉空行', () => {
    const result = applyFilter(lines, '');
    expect(result.lines).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('大小写不敏感匹配', () => {
    const result = applyFilter(lines, 'error');
    expect(result.lines).toHaveLength(1);
    expect(result.matched).toBe(1);
    expect(result.total).toBe(3);
  });

  it('特殊字符按字面量匹配', () => {
    const result = applyFilter(['a.b', 'axb'], 'a.b');
    expect(result.lines).toEqual(['a.b']);
  });

  it('无匹配时返回空数组', () => {
    const result = applyFilter(lines, 'nothing-here');
    expect(result.lines).toEqual([]);
    expect(result.matched).toBe(0);
    expect(result.total).toBe(3);
  });
});

describe('行数限制', () => {
  it('默认 200 行', () => {
    expect(normalizeLines(undefined)).toBe(200);
  });

  it('限制在 1-2000 之间', () => {
    expect(normalizeLines(0)).toBe(1);
    expect(normalizeLines(999999)).toBe(2000);
    expect(normalizeLines('500')).toBe(500);
  });
});
