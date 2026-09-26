const path = require('path');

/**
 * 净化用户提供的文件名。
 *
 * 规则（见 openspec/changes/harden-security/specs/file-browser、backup-drive）：
 * - 任何一段路径为 `..` 即视为穿越意图，直接拒绝（不做静默降级）
 * - 其余情况只保留基础文件名，丢弃目录前缀（兼容 `/` 与 `\` 两种写法）
 * - 拒绝空名、`.`、`..` 与含 NUL 字符的名字
 * - 其余字符一律保留（中文、空格、括号、点号等），避免过度收紧
 *
 * @param {string} name 用户提供的文件名
 * @returns {string} 净化后的文件名
 * @throws {Error} 名字非法时抛出
 */
function hasTraversalSegment(value) {
  const normalized = value.replace(/\\/g, '/');
  return normalized.split('/').includes('..');
}

function sanitizeFilename(name) {
  if (typeof name !== 'string') {
    throw new Error('文件名不合法');
  }
  if (name.includes('\0')) {
    throw new Error('文件名不合法');
  }

  // 同时校验原文与一次百分号解码后的形式，
  // 以覆盖 `..%2F..%2Fetc%2Fpasswd` 这类编码形式的穿越尝试
  if (hasTraversalSegment(name)) {
    throw new Error('文件名包含路径穿越片段');
  }

  let decoded = null;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    // 非法百分号序列：忽略，按原文继续校验
  }
  if (decoded !== null && decoded !== name && hasTraversalSegment(decoded)) {
    throw new Error('文件名包含路径穿越片段');
  }

  const base = path.posix.basename(name.replace(/\\/g, '/'));
  if (!base || base === '.' || base === '..') {
    throw new Error('文件名不合法');
  }

  return base;
}

/**
 * 校验 targetPath 位于 baseDir 之内（含 baseDir 本身）。
 * 以解析后的绝对路径做前缀比较，避免 `..` 逃逸与「同前缀目录」误判。
 *
 * @param {string} baseDir 允许的根目录
 * @param {string} targetPath 待校验的路径
 * @returns {string} 解析后的绝对路径
 * @throws {Error} 越界时抛出
 */
function assertInside(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);

  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('目标路径越界');
  }

  return target;
}

module.exports = { sanitizeFilename, assertInside };
