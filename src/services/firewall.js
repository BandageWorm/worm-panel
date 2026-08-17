const { execFile } = require('child_process');
const { promisify } = require('util');
const config = require('./config');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

// 执行 ufw 命令，自动 sudo 重试
async function ufwExec(args) {
  try {
    const { stdout } = await execFileAsync('sudo', ['ufw', ...args], {
      encoding: 'utf8',
      timeout: 15000
    });
    return stdout;
  } catch (e) {
    const output = (e.stderr || '') + (e.stdout || '');
    throw new Error(output.trim() || e.message);
  }
}

// 检查 ufw 是否可用
async function isAvailable() {
  try {
    await execFileAsync('which', ['ufw'], { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// 获取防火墙状态
async function getStatus() {
  if (!(await isAvailable())) {
    return { available: false, error: 'ufw 未安装' };
  }

  try {
    const output = await ufwExec(['status', 'verbose']);
    const statusMatch = output.match(/Status:\s*(\w+)/);
    const enabled = statusMatch ? statusMatch[1] === 'active' : false;

    let defaultPolicy = null;
    if (enabled) {
      const defaultMatch = output.match(/Default:\s*(\w+)\s*\(incoming\)/);
      defaultPolicy = defaultMatch ? defaultMatch[1] : 'deny';
    }

    return { available: true, enabled, defaultPolicy };
  } catch (e) {
    logger.error('Firewall', '获取状态失败', e);
    return { available: true, enabled: false, defaultPolicy: null, error: e.message };
  }
}

// 解析 ufw status numbered 输出
function parseRules(output) {
  const rules = [];
  const lines = output.split('\n');
  const panelPort = getPanelPort();

  for (const line of lines) {
    // 格式: [ 1] 22/tcp    ALLOW IN    Anywhere
    //        [ 2] 80,443/tcp   ALLOW IN    Anywhere
    const match = line.match(/^\[\s*(\d+)\]\s+(.+?)\s+(ALLOW|DENY|REJECT|LIMIT)\s+IN\s+(.*)$/);
    if (!match) continue;

    const id = parseInt(match[1], 10);
    const toRaw = match[2].trim();
    const action = match[3].toLowerCase();
    const fromRaw = match[4].trim();

    // 解析端口和协议
    let to = toRaw;
    let protocol = '';
    const protoMatch = toRaw.match(/^(.+?)\/(\w+)$/);
    if (protoMatch) {
      to = protoMatch[1];
      protocol = protoMatch[2];
    }

    // 解析来源
    const from = fromRaw === 'Anywhere' ? '*' : fromRaw;

    // 判断是否 v6
    const v6 = line.includes('(v6)');

    // 判断是否是面板端口
    const locked = isPortMatchPanel(to, panelPort);

    rules.push({ id, to, protocol, action, from, v6, locked });
  }

  return rules;
}

// 获取面板当前端口
function getPanelPort() {
  const cfg = config.load();
  return cfg.port || 4567;
}

// 判断端口是否匹配面板端口
function isPortMatchPanel(portStr, panelPort) {
  const port = parseInt(portStr, 10);
  if (port === panelPort) return true;
  // 端口范围情况
  const rangeMatch = portStr.match(/^(\d+):(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (panelPort >= start && panelPort <= end) return true;
  }
  return false;
}

// 获取规则列表
async function getRules() {
  try {
    const output = await ufwExec(['status', 'numbered']);
    return parseRules(output);
  } catch (e) {
    logger.error('Firewall', '获取规则列表失败', e);
    throw e;
  }
}

// 添加规则
async function addRule({ port, protocol, action, from, ipVersion }) {
  if (!port) throw new Error('端口不能为空');
  if (!action || !['allow', 'deny', 'reject', 'limit'].includes(action)) {
    throw new Error('无效的动作，支持: allow, deny, reject, limit');
  }

  // 根据 ipVersion 确定 from 地址
  // ufw 默认同时添加 v4+v6，指定 from 0.0.0.0/0 则只 v4，from ::/0 则只 v6
  let effectiveFrom = from && from !== '*' ? from : null;
  if (!effectiveFrom && ipVersion === 'v4') effectiveFrom = '0.0.0.0/0';
  if (!effectiveFrom && ipVersion === 'v6') effectiveFrom = '::/0';

  const args = [];
  if (effectiveFrom) {
    args.push(action, 'from', effectiveFrom, 'to', 'any', 'port', String(port));
    if (protocol) {
      args.push('proto', protocol);
    }
  } else {
    if (protocol) {
      args.push(action, `${port}/${protocol}`);
    } else {
      args.push(action, String(port));
    }
  }

  try {
    const output = await ufwExec(args);
    logger.info('Firewall', `添加规则: ufw ${args.join(' ')}`);
    return { success: true, output: output.trim() };
  } catch (e) {
    logger.error('Firewall', `添加规则失败: ufw ${args.join(' ')}`, e);
    throw e;
  }
}

// 删除规则
async function deleteRule(ruleId) {
  // 先获取规则列表，检查是否是面板端口
  const rules = await getRules();
  const rule = rules.find(r => r.id === ruleId);
  if (!rule) {
    throw new Error('规则不存在');
  }
  if (rule.locked) {
    throw new Error('不能删除面板自身端口的规则');
  }

  try {
    const output = await ufwExec(['--force', 'delete', String(ruleId)]);
    logger.info('Firewall', `删除规则 #${ruleId}`);
    return { success: true, output: output.trim() };
  } catch (e) {
    logger.error('Firewall', `删除规则 #${ruleId} 失败`, e);
    throw e;
  }
}

// 启用防火墙
async function enable() {
  try {
    const output = await ufwExec(['--force', 'enable']);
    logger.info('Firewall', '防火墙已启用');
    return { success: true, output: output.trim() };
  } catch (e) {
    logger.error('Firewall', '启用防火墙失败', e);
    throw e;
  }
}

// 关闭防火墙
async function disable() {
  try {
    const output = await ufwExec(['--force', 'disable']);
    logger.info('Firewall', '防火墙已关闭');
    return { success: true, output: output.trim() };
  } catch (e) {
    logger.error('Firewall', '关闭防火墙失败', e);
    throw e;
  }
}

module.exports = {
  getStatus,
  getRules,
  addRule,
  deleteRule,
  enable,
  disable,
  isAvailable
};
