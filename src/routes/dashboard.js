const { Router } = require('express');
const monitor = require('../services/monitor');
const metrics = require('../services/metrics');
const traffic = require('../services/traffic');
const health = require('../services/health');
const config = require('../services/config');
const logger = require('../utils/logger');

const router = Router();

// 首次采样完成前的兜底：现场采集一次，保证首屏有数据
async function liveSnapshot() {
  const [cpu, memory, disk, network] = await Promise.all([
    monitor.getCpuUsage(),
    monitor.getMemoryUsage(),
    monitor.getDiskUsage(),
    monitor.getNetworkStats()
  ]);
  return {
    cpu: cpu.usage,
    mem: memory.percent,
    disk: disk.percent,
    rxSpeed: network.rxSpeed,
    txSpeed: network.txSpeed,
    netRx: network.rxBytes,
    netTx: network.txBytes,
    memTotal: memory.total,
    memUsed: memory.used,
    memAvailable: memory.available,
    diskTotal: disk.total,
    diskUsed: disk.used,
    diskMount: disk.mount,
    cores: cpu.cores,
    cpuModel: cpu.model
  };
}

router.get('/', async (req, res) => {
  try {
    const [system, uptime, networkIfaces, healthData] = await Promise.all([
      monitor.getSystemInfo(),
      monitor.getUptime(),
      monitor.getNetworkInterfaces(),
      health.getHealth()
    ]);

    let latest = metrics.getLatest();
    if (!latest) {
      try {
        latest = await liveSnapshot();
      } catch (err) {
        logger.warn('Dashboard', '首次采样兜底失败：' + (err.message || err));
        latest = null;
      }
    }
    const snap = latest || {};

    const cfg = config.load();

    let trafficSummary = null;
    try {
      trafficSummary = traffic.getSummary();
    } catch (err) {
      logger.warn('Dashboard', '读取流量统计失败：' + (err.message || err));
    }

    res.json({
      system: {
        os: system.os,
        kernel: system.kernel,
        hostname: system.hostname,
        uptime,
        ip: networkIfaces.primary,
        ipList: networkIfaces.list
      },
      cpu: {
        usage: snap.cpu || 0,
        cores: snap.cores || 0,
        model: snap.cpuModel || ''
      },
      memory: {
        total: snap.memTotal || 0,
        used: snap.memUsed || 0,
        available: snap.memAvailable || 0,
        percent: snap.mem || 0
      },
      disk: {
        total: snap.diskTotal || 0,
        used: snap.diskUsed || 0,
        percent: snap.disk || 0,
        mount: snap.diskMount || '/'
      },
      network: {
        rxBytes: snap.netRx || 0,
        txBytes: snap.netTx || 0,
        rxSpeed: snap.rxSpeed || 0,
        txSpeed: snap.txSpeed || 0
      },
      health: healthData,
      traffic: trafficSummary,
      panel: {
        version: '1.0.0',
        mode: cfg.mode,
        port: cfg.port,
        uptime: process.uptime(),
        // 前端据此决定自动刷新间隔
        dashboardRefresh: config.getSettings(cfg).dashboardRefresh
      }
    });
  } catch (err) {
    logger.error('Dashboard', '获取系统信息失败', err);
    res.status(500).json({ error: '获取系统信息失败' });
  }
});

module.exports = router;
