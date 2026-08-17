const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'cron-history');
const MAX_HISTORY = 50;
const EXEC_TIMEOUT = 60000; // 60 秒

// 面板任务标识前缀
const WORM_PREFIX = '# worm:';

// 简单互斥锁
let writeLock = null;

async function acquireLock() {
  while (writeLock) {
    await writeLock;
  }
  let resolve;
  writeLock = new Promise(r => { resolve = r; });
  return resolve;
}

function releaseLock(resolve) {
  writeLock = null;
  resolve();
}

// 确保历史目录存在
function ensureHistoryDir() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

// 生成短 ID
function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// 读取 crontab 内容
async function readCrontab() {
  try {
    const { stdout } = await execAsync('crontab -l 2>/dev/null', {
      encoding: 'utf8',
      timeout: 10000
    });
    return stdout;
  } catch (e) {
    // crontab -l 在无 crontab 时返回非零
    if (e.stderr && e.stderr.includes('no crontab')) {
      return '';
    }
    return '';
  }
}

// 写入 crontab 内容
async function writeCrontab(content) {
  try {
    await execAsync(`echo "${content.replace(/"/g, '\\"')}" | crontab -`, {
      encoding: 'utf8',
      timeout: 10000,
      shell: '/bin/bash'
    });
  } catch (e) {
    logger.error('Cron', '写入 crontab 失败', e);
    throw new Error('写入 crontab 失败: ' + e.message);
  }
}

// 解析 crontab 内容为任务列表
function parseCrontab(content) {
  const lines = content.split('\n');
  const jobs = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 检查是否是面板管理的任务标识行
    if (line.startsWith(WORM_PREFIX)) {
      // 解析标识: # worm:<id>:<name>
      const meta = line.slice(WORM_PREFIX.length);
      const colonIdx = meta.indexOf(':');
      const id = colonIdx > 0 ? meta.slice(0, colonIdx) : meta;
      const name = colonIdx > 0 ? meta.slice(colonIdx + 1) : '';

      // 下一行是实际的 cron 行
      i++;
      if (i < lines.length) {
        const cronLine = lines[i];
        const enabled = !cronLine.startsWith('#');
        const actualLine = enabled ? cronLine : cronLine.replace(/^#\s?/, '');

        // 解析 cron 表达式和命令
        const parsed = parseCronLine(actualLine);
        if (parsed) {
          jobs.push({
            id,
            name,
            schedule: parsed.schedule,
            command: parsed.command,
            enabled,
            managed: true
          });
        }
      }
    } else if (line.trim() && !line.startsWith('#') && !line.match(/^\w+=.*/)) {
      // 非面板管理的 cron 行（非空、非注释、非环境变量）
      const parsed = parseCronLine(line);
      if (parsed) {
        jobs.push({
          id: null,
          name: '',
          schedule: parsed.schedule,
          command: parsed.command,
          enabled: true,
          managed: false
        });
      }
    }
    i++;
  }

  return jobs;
}

// 解析单行 cron 表达式
function parseCronLine(line) {
  // cron 格式: min hour day month weekday command
  const match = line.match(/^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/);
  if (!match) return null;
  return { schedule: match[1], command: match[2] };
}

// 获取所有任务
async function listJobs() {
  const content = await readCrontab();
  return parseCrontab(content);
}

// 创建任务
async function createJob({ name, schedule, command }) {
  if (!name || !name.trim()) throw new Error('任务名称不能为空');
  if (!schedule || !schedule.trim()) throw new Error('执行周期不能为空');
  if (!command || !command.trim()) throw new Error('命令不能为空');

  const resolve = await acquireLock();
  try {
    const content = await readCrontab();
    const jobs = parseCrontab(content);

    // 检查名称重复
    if (jobs.some(j => j.managed && j.name === name.trim())) {
      throw new Error('任务名称已存在');
    }

    const id = generateId();
    const newLines = `${WORM_PREFIX}${id}:${name.trim()}\n${schedule.trim()} ${command.trim()}`;

    const newContent = content.trimEnd() + (content.trim() ? '\n' : '') + newLines + '\n';
    await writeCrontab(newContent);

    logger.info('Cron', `创建任务: ${name} (${id})`);
    return { id, name: name.trim(), schedule: schedule.trim(), command: command.trim(), enabled: true, managed: true };
  } finally {
    releaseLock(resolve);
  }
}

// 编辑任务
async function updateJob(id, { name, schedule, command, enabled }) {
  if (!id) throw new Error('任务 ID 不能为空');

  const resolve = await acquireLock();
  try {
    const content = await readCrontab();
    const lines = content.split('\n');
    let found = false;
    const newLines = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith(`${WORM_PREFIX}${id}:`)) {
        found = true;
        // 当前标识行
        const meta = line.slice(WORM_PREFIX.length);
        const colonIdx = meta.indexOf(':');
        const oldName = colonIdx > 0 ? meta.slice(colonIdx + 1) : '';

        // 下一行是 cron 行
        i++;
        const cronLine = i < lines.length ? lines[i] : '';
        const wasEnabled = !cronLine.startsWith('#');
        const actualLine = wasEnabled ? cronLine : cronLine.replace(/^#\s?/, '');
        const parsed = parseCronLine(actualLine) || { schedule: '* * * * *', command: '' };

        // 更新字段
        const newName = name !== undefined ? name.trim() : oldName;
        const newSchedule = schedule !== undefined ? schedule.trim() : parsed.schedule;
        const newCommand = command !== undefined ? command.trim() : parsed.command;
        const newEnabled = enabled !== undefined ? enabled : wasEnabled;

        // 检查名称重复（如果改了名）
        if (name !== undefined && name.trim() !== oldName) {
          const jobs = parseCrontab(content);
          if (jobs.some(j => j.managed && j.id !== id && j.name === name.trim())) {
            throw new Error('任务名称已存在');
          }
        }

        // 写入新标识行和 cron 行
        newLines.push(`${WORM_PREFIX}${id}:${newName}`);
        const cronContent = `${newSchedule} ${newCommand}`;
        newLines.push(newEnabled ? cronContent : `# ${cronContent}`);
      } else {
        newLines.push(line);
      }
      i++;
    }

    if (!found) throw new Error('任务不存在');

    await writeCrontab(newLines.join('\n'));
    logger.info('Cron', `更新任务: ${id}`);
    return { success: true };
  } finally {
    releaseLock(resolve);
  }
}

// 删除任务
async function deleteJob(id) {
  if (!id) throw new Error('任务 ID 不能为空');

  const resolve = await acquireLock();
  try {
    const content = await readCrontab();
    const lines = content.split('\n');
    let found = false;
    const newLines = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith(`${WORM_PREFIX}${id}:`)) {
        found = true;
        // 跳过标识行和下一行（cron 行）
        i++; // 跳过 cron 行
      } else {
        newLines.push(line);
      }
      i++;
    }

    if (!found) throw new Error('任务不存在');

    await writeCrontab(newLines.join('\n'));

    // 清理历史记录文件
    const histFile = path.join(HISTORY_DIR, `${id}.jsonl`);
    if (fs.existsSync(histFile)) {
      fs.unlinkSync(histFile);
    }

    logger.info('Cron', `删除任务: ${id}`);
    return { success: true };
  } finally {
    releaseLock(resolve);
  }
}

// 立即执行任务
async function runJob(id) {
  const content = await readCrontab();
  const jobs = parseCrontab(content);
  const job = jobs.find(j => j.id === id && j.managed);
  if (!job) throw new Error('任务不存在');

  const startTime = Date.now();
  let result;

  try {
    const { stdout, stderr } = await execAsync(job.command, {
      encoding: 'utf8',
      timeout: EXEC_TIMEOUT,
      shell: '/bin/bash'
    });
    result = {
      time: new Date(startTime).toISOString(),
      exitCode: 0,
      stdout: stdout.slice(0, 10000),
      stderr: stderr.slice(0, 5000),
      duration: Date.now() - startTime
    };
  } catch (e) {
    const timedOut = e.killed || (e.signal === 'SIGTERM');
    result = {
      time: new Date(startTime).toISOString(),
      exitCode: timedOut ? -1 : (e.code || 1),
      stdout: (e.stdout || '').slice(0, 10000),
      stderr: (e.stderr || e.message || '').slice(0, 5000),
      duration: Date.now() - startTime,
      timeout: timedOut
    };
  }

  // 写入历史
  appendHistory(id, result);
  logger.info('Cron', `执行任务 ${id}: exitCode=${result.exitCode}, duration=${result.duration}ms`);
  return result;
}

// 获取执行历史
function getHistory(id) {
  ensureHistoryDir();
  const histFile = path.join(HISTORY_DIR, `${id}.jsonl`);
  if (!fs.existsSync(histFile)) return [];

  try {
    const content = fs.readFileSync(histFile, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const records = lines.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    // 按时间倒序返回
    return records.reverse();
  } catch {
    return [];
  }
}

// 追加历史记录
function appendHistory(id, record) {
  ensureHistoryDir();
  const histFile = path.join(HISTORY_DIR, `${id}.jsonl`);

  // 读取现有记录
  let lines = [];
  if (fs.existsSync(histFile)) {
    const content = fs.readFileSync(histFile, 'utf8');
    lines = content.trim().split('\n').filter(Boolean);
  }

  // 追加新记录
  lines.push(JSON.stringify(record));

  // 保留最近 MAX_HISTORY 条
  if (lines.length > MAX_HISTORY) {
    lines = lines.slice(lines.length - MAX_HISTORY);
  }

  fs.writeFileSync(histFile, lines.join('\n') + '\n', 'utf8');
}

module.exports = {
  listJobs,
  createJob,
  updateJob,
  deleteJob,
  runJob,
  getHistory,
  ensureHistoryDir
};
