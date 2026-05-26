const { Router } = require('express');
const monitor = require('../services/monitor');
const config = require('../services/config');
const logger = require('../utils/logger');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [system, cpu, memory, disk, network, uptime, networkIfaces] = await Promise.all([
      monitor.getSystemInfo(),
      monitor.getCpuUsage(),
      monitor.getMemoryUsage(),
      monitor.getDiskUsage(),
      monitor.getNetworkStats(),
      monitor.getUptime(),
      monitor.getNetworkInterfaces()
    ]);

    const cfg = config.load();

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
        usage: cpu.usage,
        cores: cpu.cores,
        model: cpu.model
      },
      memory: {
        total: memory.total,
        used: memory.used,
        percent: memory.percent
      },
      disk: {
        total: disk.total,
        used: disk.used,
        percent: disk.percent,
        mount: disk.mount
      },
      network: {
        rxBytes: network.rxBytes,
        txBytes: network.txBytes,
        rxSpeed: network.rxSpeed,
        txSpeed: network.txSpeed
      },
      panel: {
        version: '1.0.0',
        mode: cfg.mode,
        port: cfg.port,
        uptime: process.uptime()
      }
    });
  } catch (err) {
    logger.error('Dashboard', '获取系统信息失败', err);
    res.status(500).json({ error: '获取系统信息失败' });
  }
});

module.exports = router;
