const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const config = require('./config');
const nginx = require('./nginx');
const pm2 = require('./pm2');
const firewall = require('./firewall');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

const MAX_PROCESS_LIMIT = 500;
const PM2_CACHE_MS = 30000;
const NGINX_PID_FILE = '/run/nginx.pid';

// 受保护进程：即使有权限也不允许从面板终止
const PROTECTED_NAMES = new Set(['systemd', 'init', 'sshd']);

let pm2Cache = { at: 0, byPid: new Map(), byName: new Map() };

function safeInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseProcesses(text) {
  const found = [];
  const re = /\("([^"]+)",pid=(\d+)/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    found.push({ name: match[1], pid: Number(match[2]) });
  }
  return found;
}

function splitAddress(addr) {
  const text = String(addr || '');
  const idx = text.lastIndexOf(':');
  if (idx === -1) return { address: text, port: null };
  const address = text.slice(0, idx);
  const portText = text.slice(idx + 1);
  const port = /^\d+$/.test(portText) ? Number(portText) : null;
  return { address, port };
}

// ss -H -tulpn 的每行结构：
// tcp LISTEN 0 511 0.0.0.0:80 0.0.0.0:* users:(("nginx",pid=123,fd=6),...)
// udp UNCONN 0 0 0.0.0.0:68 0.0.0.0:*
function parseSsOutput(output) {
  const rows = [];
  for (const line of String(output || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cols = trimmed.split(/\s+/);
    if (cols.length < 5) continue;

    const netid = cols[0];
    if (!['tcp', 'tcp6', 'udp', 'udp6'].includes(netid)) continue;

    const state = cols[1];
    const local = cols[4];
    const peer = cols[5] || '';
    const procText = cols.slice(6).join(' ');

    const { address, port } = splitAddress(local);
    const peerInfo = splitAddress(peer);
    const processes = parseProcesses(procText);

    rows.push({
      netid,
      protocol: netid.startsWith('udp') ? 'udp' : 'tcp',
      state,
      address,
      port,
      peerPort: peerInfo.port,
      processes,
      raw: trimmed
    });
  }
  return rows;
}

function parsePsOutput(output, limit) {
  const lines = String(output || '').split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  // 第一行是表头
  const hasHeader = /^\s*PID\s+PPID/i.test(lines[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.slice(0, limit).map(line => {
    const parts = line.trim().split(/\s+/);
    const [pid, ppid, user, pcpu, pmem, rss, etime] = parts;
    const args = parts.slice(7).join(' ');
    return {
      pid: safeInt(pid),
      ppid: safeInt(ppid),
      user: user || '',
      cpu: Number(pcpu) || 0,
      memPercent: Number(pmem) || 0,
      rss: safeInt(rss) * 1024,
      elapsed: etime || '',
      command: args || ''
    };
  }).filter(p => p.pid > 0);
}

function extractListenPorts(listen) {
  const text = String(listen || '').trim();
  if (!text) return [];

  // 形如 "80"、"443 ssl"、"0.0.0.0:8080"、"[::]:443 default_server"、"8080-8090"
  const first = text.split(/\s+/)[0];
  const portText = (first.includes(':') ? first.slice(first.lastIndexOf(':') + 1) : first).replace(/[^\d-]/g, '');
  if (!portText) return [];

  if (portText.includes('-')) {
    const [start, end] = portText.split('-').map(v => safeInt(v));
    if (!start || !end) return [];
    const ports = [];
    for (let p = start; p <= end && p - start < 20; p++) ports.push(p);
    return ports;
  }

  const port = safeInt(portText);
  return port > 0 ? [port] : [];
}

function expandUfwPorts(to) {
  const ports = [];
  for (const part of String(to || '').split(',')) {
    const text = part.trim();
    if (!text) continue;
    if (text.includes('-')) {
      const [a, b] = text.split('-').map(v => safeInt(v));
      if (a && b) {
        for (let p = a; p <= b && p - a < 1000; p++) ports.push(p);
      }
    } else if (text === 'Anywhere' || text === '*') {
      ports.push('*');
    } else {
      const n = safeInt(text);
      if (n) ports.push(n);
    }
  }
  return ports;
}

async function getPm2Maps() {
  if (pm2Cache.byPid.size > 0 && Date.now() - pm2Cache.at < PM2_CACHE_MS) return pm2Cache;
  const byPid = new Map();
  const byName = new Map();
  try {
    const list = await pm2.list();
    for (const p of list || []) {
      if (p.pid) byPid.set(p.pid, p.name);
      byName.set(p.name, p);
    }
  } catch (err) {
    logger.warn('Ports', 'PM2 状态查询失败：' + (err.message || err));
    byPid.clear();
    byName.clear();
    return { at: Date.now(), byPid, byName, failed: true };
  }
  pm2Cache = { at: Date.now(), byPid, byName };
  return pm2Cache;
}

async function getUfwAllowedPorts() {
  try {
    const rules = await firewall.getRules();
    const allowed = new Set();
    for (const rule of rules) {
      if (rule.action !== 'allow') continue;
      for (const p of expandUfwPorts(rule.to)) allowed.add(p);
    }
    // ufw 未启用时无法判断放行状态，返回 null 让上层跳过该提示
    return allowed.size > 0 ? allowed : null;
  } catch {
    return null;
  }
}

function readNginxMasterPid() {
  try {
    if (fs.existsSync(NGINX_PID_FILE)) {
      const pid = safeInt(fs.readFileSync(NGINX_PID_FILE, 'utf8').trim());
      if (pid > 0) return pid;
    }
  } catch {
    // ignore
  }
  return null;
}

async function listPorts() {
  const { stdout } = await execFileAsync('ss', ['-H', '-tulpn'], {
    timeout: 8000,
    maxBuffer: 4 * 1024 * 1024
  });

  const rows = parseSsOutput(stdout);
  const cfg = config.load();
  const panelPort = safeInt(cfg.port, 4567);

  let sitePortMap = new Map();
  try {
    const sites = nginx.listSites();
    for (const site of sites) {
      for (const port of extractListenPorts(site.listen)) {
        if (!sitePortMap.has(port)) sitePortMap.set(port, []);
        sitePortMap.get(port).push(site.serverName || site.name);
      }
    }
  } catch (err) {
    logger.warn('Ports', '读取 nginx 站点失败：' + (err.message || err));
  }

  const pm2Maps = await getPm2Maps();
  const ufwAllowed = await getUfwAllowedPorts();

  return rows
    .map(row => {
      const labels = [];

      if (row.port === panelPort) labels.push({ type: 'panel', text: '面板自身' });

      const sites = sitePortMap.get(row.port);
      if (sites && sites.length > 0) {
        labels.push({ type: 'nginx', text: `站点 ${sites.join(' / ')}` });
      }

      for (const proc of row.processes) {
        const pm2Name = pm2Maps.byPid.get(proc.pid);
        if (pm2Name) {
          labels.push({ type: 'pm2', text: `PM2 ${pm2Name}` });
          break;
        }
      }

      const unknownProcess = row.processes.length === 0;
      if (ufwAllowed && row.port && row.port < 65536 && !ufwAllowed.has(row.port) && !ufwAllowed.has('*')) {
        labels.push({ type: 'firewall', text: '未在防火墙放行' });
      }

      return {
        ...row,
        labels,
        processText: unknownProcess ? '未知' : row.processes.map(p => `${p.name}(${p.pid})`).join(', ')
      };
    })
    .sort((a, b) => (a.port || 0) - (b.port || 0));
}

async function listProcesses({ limit = 50, sort = 'cpu' } = {}) {
  const safeLimit = Math.min(MAX_PROCESS_LIMIT, Math.max(1, safeInt(limit, 50)));
  const sortArg = sort === 'mem' ? '-pmem' : '-pcpu';

  const { stdout } = await execFileAsync(
    'ps',
    ['-eo', 'pid,ppid,user,pcpu,pmem,rss,etime,args', `--sort=${sortArg}`],
    { timeout: 8000, maxBuffer: 8 * 1024 * 1024 }
  );

  const processes = parsePsOutput(stdout, safeLimit);
  const protectedPids = getProtectedPids();

  return processes.map(p => ({
    ...p,
    command: p.command.length > 400 ? p.command.slice(0, 400) + '…' : p.command,
    commandFull: p.command,
    protected: protectedPids.has(p.pid),
    protectReason: protectedPids.get(p.pid) || null
  }));
}

function getProtectedPids() {
  const map = new Map();
  map.set(1, '系统 init 进程');
  if (process.pid) map.set(process.pid, '面板自身进程');

  const nginxMaster = readNginxMasterPid();
  if (nginxMaster) map.set(nginxMaster, 'Nginx 主进程');

  return map;
}

function assertKillable(pid) {
  const target = safeInt(pid);
  if (target <= 0) throw new Error('进程 ID 不合法');

  const protectedPids = getProtectedPids();
  if (protectedPids.has(target)) {
    throw new Error(`不允许终止该进程（${protectedPids.get(target)}）`);
  }
  return target;
}

async function killProcess(pid, signal = 'SIGTERM') {
  const target = assertKillable(pid);
  const allowed = ['SIGTERM', 'SIGKILL'];
  const sig = allowed.includes(signal) ? signal : 'SIGTERM';

  // 名称级保护：即使 pid 不在保护表里，也不允许终止 sshd / systemd
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'comm=', '-p', String(target)], { timeout: 3000 });
    const name = stdout.trim().split('/').pop();
    if (PROTECTED_NAMES.has(name)) {
      throw new Error(`不允许终止系统关键进程（${name}）`);
    }
  } catch (err) {
    if (err.message && err.message.startsWith('不允许')) throw err;
    // 进程可能刚好退出，交给下面的 kill 判定
  }

  try {
    process.kill(target, sig);
  } catch (err) {
    if (err.code === 'ESRCH') throw new Error('进程不存在，可能已经退出');
    if (err.code === 'EPERM') throw new Error('权限不足，无法终止该进程');
    throw new Error('终止进程失败：' + (err.message || err));
  }

  logger.info('Ports', `终止进程 pid=${target} signal=${sig}`);
  return { success: true, pid: target, signal: sig };
}

module.exports = {
  listPorts,
  listProcesses,
  killProcess,
  _test: { parseSsOutput, parsePsOutput, extractListenPorts, splitAddress, expandUfwPorts, assertKillable }
};
