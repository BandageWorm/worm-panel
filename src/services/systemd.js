const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// 受保护的服务名
const PROTECTED_SERVICE = 'worm-panel.service';

// 服务名校验正则
const SERVICE_NAME_REGEX = /^[a-zA-Z0-9@._-]+$/;

/**
 * 校验服务名格式
 */
function validateServiceName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('服务名不能为空');
  }
  if (!SERVICE_NAME_REGEX.test(name)) {
    throw new Error('服务名格式非法，仅允许字母、数字、@、.、_、-');
  }
}

/**
 * 执行 systemctl 命令（读操作，不需要 sudo）
 */
async function systemctlExec(args, options = {}) {
  try {
    const { stdout } = await execFileAsync('systemctl', args, {
      encoding: 'utf8',
      timeout: options.timeout || 15000
    });
    return stdout;
  } catch (e) {
    // 如果是权限问题，尝试 sudo
    const output = (e.stderr || '') + (e.stdout || '');
    if (output.includes('Permission denied') || output.includes('Access denied')) {
      const { stdout } = await execFileAsync('sudo', ['systemctl', ...args], {
        encoding: 'utf8',
        timeout: options.timeout || 15000
      });
      return stdout;
    }
    throw e;
  }
}

/**
 * 执行 systemctl 写操作（始终使用 sudo）
 */
async function systemctlWrite(args) {
  try {
    const { stdout } = await execFileAsync('sudo', ['systemctl', ...args], {
      encoding: 'utf8',
      timeout: 30000
    });
    return stdout;
  } catch (e) {
    const msg = (e.stderr || e.message || '').trim();
    throw new Error(msg || '操作失败');
  }
}

/**
 * 执行 journalctl 命令
 */
async function journalctlExec(args) {
  try {
    const { stdout } = await execFileAsync('journalctl', args, {
      encoding: 'utf8',
      timeout: 15000
    });
    return stdout;
  } catch (e) {
    const output = (e.stderr || '') + (e.stdout || '');
    if (output.includes('Permission denied')) {
      const { stdout } = await execFileAsync('sudo', ['journalctl', ...args], {
        encoding: 'utf8',
        timeout: 15000
      });
      return stdout;
    }
    throw e;
  }
}

/**
 * 获取单个服务的 enabled 状态
 */
async function getEnabledState(name) {
  try {
    const stdout = await systemctlExec(['is-enabled', name]);
    return stdout.trim();
  } catch (e) {
    // is-enabled 对于 disabled 的服务会返回非零退出码
    const output = (e.stdout || e.stderr || '').trim();
    return output || 'unknown';
  }
}

/**
 * 获取所有 service 列表
 * 返回按 active 优先排序的服务数组
 */
async function listServices() {
  const stdout = await systemctlExec([
    'list-units', '--type=service', '--all', '--no-pager', '--output=json'
  ]);

  let units;
  try {
    units = JSON.parse(stdout);
  } catch {
    // fallback: 某些较旧版本不支持 --output=json，用文本解析
    units = parseListUnitsText(stdout);
  }

  // 获取每个服务的 enabled 状态
  const enabledStates = await getEnabledStates(units.map(u => u.unit));

  const services = units.map(u => {
    const name = u.unit || u.UNIT || '';
    return {
      name,
      active_state: u.active || u.ACTIVE || 'unknown',
      sub_state: u.sub || u.SUB || 'unknown',
      enabled: enabledStates[name] || 'unknown',
      description: u.description || u.DESCRIPTION || ''
    };
  });

  // 排序：active 在前，failed 其次，inactive 最后；同状态按名称排序
  const stateOrder = { active: 0, reloading: 0, activating: 1, deactivating: 2, failed: 3, inactive: 4 };
  services.sort((a, b) => {
    const orderA = stateOrder[a.active_state] ?? 5;
    const orderB = stateOrder[b.active_state] ?? 5;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return services;
}

/**
 * 批量获取 enabled 状态
 */
async function getEnabledStates(names) {
  const result = {};
  // 使用 list-unit-files 一次获取所有状态
  try {
    const stdout = await systemctlExec([
      'list-unit-files', '--type=service', '--no-pager', '--output=json'
    ]);
    let files;
    try {
      files = JSON.parse(stdout);
    } catch {
      files = [];
    }
    for (const f of files) {
      const name = f.unit_file || f['UNIT FILE'] || '';
      result[name] = f.state || f.STATE || 'unknown';
    }
  } catch {
    // fallback: 逐个查询
    for (const name of names) {
      result[name] = await getEnabledState(name);
    }
  }
  return result;
}

/**
 * 文本格式 fallback 解析
 */
function parseListUnitsText(text) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('UNIT') && !l.includes(' loaded units listed'));
  return lines.map(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      return {
        unit: parts[0],
        active: parts[2],
        sub: parts[3],
        description: parts.slice(4).join(' ')
      };
    }
    return null;
  }).filter(Boolean);
}

/**
 * 获取服务详情
 */
async function getServiceDetail(name) {
  validateServiceName(name);

  const stdout = await systemctlExec(['show', name, '--no-pager']);

  // 解析 key=value 格式
  const props = {};
  for (const line of stdout.split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      props[line.substring(0, idx)] = line.substring(idx + 1);
    }
  }

  // 获取 enabled 状态
  const enabled = await getEnabledState(name);

  return {
    name,
    description: props.Description || '',
    activeState: props.ActiveState || 'unknown',
    subState: props.SubState || 'unknown',
    mainPID: parseInt(props.MainPID) || 0,
    memoryCurrent: parseInt(props.MemoryCurrent) || 0,
    activeEnterTimestamp: props.ActiveEnterTimestamp || '',
    fragmentPath: props.FragmentPath || '',
    loadState: props.LoadState || 'unknown',
    unitFileState: enabled,
    execMainStartTimestamp: props.ExecMainStartTimestamp || '',
    tasks: parseInt(props.TasksCurrent) || 0,
    type: props.Type || ''
  };
}

/**
 * 获取服务日志
 */
async function getServiceLogs(name, lines = 100) {
  validateServiceName(name);
  const n = Math.min(Math.max(parseInt(lines) || 100, 1), 1000);

  const stdout = await journalctlExec([
    '-u', name, '--no-pager', '-n', String(n), '--output=short'
  ]);

  return stdout;
}

/**
 * 执行服务控制操作
 */
async function controlService(name, action) {
  validateServiceName(name);

  const allowedActions = ['start', 'stop', 'restart', 'reload', 'enable', 'disable'];
  if (!allowedActions.includes(action)) {
    throw new Error(`不支持的操作: ${action}`);
  }

  // worm-panel 保护逻辑
  if (name === PROTECTED_SERVICE || name === 'worm-panel') {
    if (action === 'stop') {
      throw new Error('面板自身服务不允许停止');
    }
    if (action === 'disable') {
      throw new Error('面板自身服务不允许禁用');
    }
  }

  await systemctlWrite([action, name]);
  return { success: true, action, service: name };
}

module.exports = {
  listServices,
  getServiceDetail,
  getServiceLogs,
  controlService,
  validateServiceName
};
