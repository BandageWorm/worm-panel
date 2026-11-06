const fs = require('fs');
const si = require('systeminformation');

let lastRx = 0;
let lastTx = 0;
let lastTs = Date.now();

async function getSystemInfo() {
  const [osInfo, system] = await Promise.all([
    si.osInfo(),
    si.system()
  ]);
  return {
    os: `${osInfo.distro} ${osInfo.release} ${osInfo.arch}`,
    kernel: osInfo.kernel,
    hostname: system.hostname
  };
}

async function getCpuUsage() {
  const [cpu, currentLoad] = await Promise.all([
    si.cpu(),
    si.currentLoad()
  ]);
  return {
    usage: Math.round(currentLoad.currentLoad * 10) / 10,
    cores: cpu.cores,
    model: cpu.brand
  };
}

// 读取 /proc/meminfo 计算已用内存：used = MemTotal - MemAvailable。
// 与 3X-UI（gopsutil v4: ret.Used = ret.Total - ret.Available）以及 htop 一致，
// 只有不可回收的部分才算已用；systeminformation 的 mem().used 是 total - free，
// 会把可回收 page cache 也算成占用，两个面板的数字就对不上了。
function readMemInfo() {
  const text = fs.readFileSync('/proc/meminfo', 'utf8');
  const map = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(\w+):\s+(\d+)(?:\s+kB)?/);
    if (m) map[m[1]] = parseInt(m[2], 10) * 1024;
  }
  return map;
}

async function getMemoryUsage() {
  try {
    const mi = readMemInfo();
    const total = mi.MemTotal;
    if (total > 0) {
      const buffers = mi.Buffers || 0;
      const cached = (mi.Cached || 0) + (mi.SReclaimable || 0);
      // 内核 3.14+ 才有 MemAvailable，缺失时按 free + 可回收缓存估算
      const available = mi.MemAvailable || (mi.MemFree || 0) + buffers + cached;
      const used = Math.max(0, total - available);
      return {
        total,
        used,
        available,
        cache: buffers + cached,
        percent: Math.round((used / total) * 100 * 10) / 10
      };
    }
  } catch {
    // 非 Linux 环境（如本地测试）回退到 systeminformation
  }

  const mem = await si.mem();
  const used = Math.max(0, mem.total - mem.available);
  return {
    total: mem.total,
    used,
    available: mem.available,
    cache: mem.buffcache || 0,
    percent: Math.round((used / mem.total) * 100 * 10) / 10
  };
}

async function getDiskUsage() {
  const disks = await si.fsSize();
  const root = disks.find(d => d.mount === '/') || disks[0];
  if (!root) {
    return { total: 0, used: 0, percent: 0, mount: '/' };
  }
  return {
    total: root.size,
    used: root.used,
    percent: Math.round(root.use * 10) / 10,
    mount: root.mount
  };
}

async function getNetworkStats() {
  const net = await si.networkStats();
  const total = net.reduce((acc, n) => ({
    rxBytes: acc.rxBytes + n.rx_bytes,
    txBytes: acc.txBytes + n.tx_bytes
  }), { rxBytes: 0, txBytes: 0 });

  const now = Date.now();
  const elapsed = (now - lastTs) / 1000;

  let rxSpeed = 0;
  let txSpeed = 0;
  if (elapsed > 0 && lastRx > 0) {
    rxSpeed = Math.max(0, (total.rxBytes - lastRx) / elapsed);
    txSpeed = Math.max(0, (total.txBytes - lastTx) / elapsed);
  }

  lastRx = total.rxBytes;
  lastTx = total.txBytes;
  lastTs = now;

  return {
    rxBytes: total.rxBytes,
    txBytes: total.txBytes,
    rxSpeed: Math.round(rxSpeed),
    txSpeed: Math.round(txSpeed)
  };
}

async function getUptime() {
  const time = await si.time();
  return time.uptime;
}

async function getNetworkInterfaces() {
  const ifaces = await si.networkInterfaces();
  const list = ifaces
    .filter(n => n.ip4 && n.ip4 !== '127.0.0.1')
    .map(n => ({ name: n.iface, ip4: n.ip4, ip6: n.ip6 }));
  return { list, primary: list.length > 0 ? list[0].ip4 : '--' };
}

module.exports = { getSystemInfo, getCpuUsage, getMemoryUsage, getDiskUsage, getNetworkStats, getUptime, getNetworkInterfaces };
