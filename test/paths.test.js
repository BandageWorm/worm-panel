const path = require('path');
const { sanitizeFilename, assertInside } = require('../src/utils/paths');

describe('sanitizeFilename', () => {
  it('拒绝含 .. 段的路径穿越', () => {
    expect(() => sanitizeFilename('../../etc/passwd')).toThrow();
    expect(() => sanitizeFilename('../escape.txt')).toThrow();
    expect(() => sanitizeFilename('a/../../b')).toThrow();
  });

  it('拒绝百分号编码形式的路径穿越', () => {
    expect(() => sanitizeFilename('..%2F..%2Fetc%2Fpasswd')).toThrow();
    expect(() => sanitizeFilename('a%5C..%5Cb')).toThrow();
  });

  it('拒绝空名、点与双点', () => {
    expect(() => sanitizeFilename('')).toThrow();
    expect(() => sanitizeFilename('.')).toThrow();
    expect(() => sanitizeFilename('..')).toThrow();
    expect(() => sanitizeFilename('/')).toThrow();
  });

  it('拒绝含 NUL 与非字符串输入', () => {
    expect(() => sanitizeFilename('a\0b')).toThrow();
    expect(() => sanitizeFilename(null)).toThrow();
    expect(() => sanitizeFilename(42)).toThrow();
  });

  it('丢弃目录前缀，只保留基础文件名', () => {
    expect(sanitizeFilename('a/b.txt')).toBe('b.txt');
    expect(sanitizeFilename('sub/dir/a.txt')).toBe('a.txt');
    expect(sanitizeFilename('dir\\b.txt')).toBe('b.txt');
  });

  it('保留中文、空格与常见符号', () => {
    expect(sanitizeFilename('中文 名.txt')).toBe('中文 名.txt');
    expect(sanitizeFilename('报告 (final) [v2].md')).toBe('报告 (final) [v2].md');
    expect(sanitizeFilename('.hidden')).toBe('.hidden');
    expect(sanitizeFilename('100%.txt')).toBe('100%.txt');
  });
});

describe('assertInside', () => {
  it('允许 base 自身与其内部路径', () => {
    expect(assertInside('/a/b', '/a/b')).toBe(path.resolve('/a/b'));
    expect(assertInside('/a/b', '/a/b/c.txt')).toBe(path.resolve('/a/b/c.txt'));
  });

  it('拒绝越界路径', () => {
    expect(() => assertInside('/a/b', '/a/c.txt')).toThrow();
    expect(() => assertInside('/a/b', '/a/b/../c.txt')).toThrow();
  });

  it('不把同前缀目录误判为内部', () => {
    expect(() => assertInside('/a/b', '/a/bc/d.txt')).toThrow();
  });
});
