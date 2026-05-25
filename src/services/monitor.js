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

async function getMemoryUsage() {
  const mem = await si.mem();
  return {
    total: mem.total,
    used: mem.used,
    percent: Math.round((mem.used / mem.total) * 100 * 10) / 10
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

module.exports = { getSystemInfo, getCpuUsage, getMemoryUsage, getDiskUsage, getNetworkStats, getUptime };
