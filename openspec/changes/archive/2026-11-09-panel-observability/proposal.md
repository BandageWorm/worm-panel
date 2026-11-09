# Proposal

## Why

面板现在只能回答"此刻 CPU 多少"，无法回答"过去一小时有没有尖峰""这个月流量还剩多少"。`src/services/monitor.js` 每次请求现场采样，数据不留存；`network.rxBytes` 是 systeminformation 自进程启动以来的累计值，与云厂商的月流量口径无关。没有历史数据，后续的阈值告警也无从判定。

## What Changes

- 将 `monitor.js` 从"即时查询"改造为「后台采集器 + 查询接口」两层：后台单例按 5 秒采样，写入内存环形缓冲（1 小时明细）+ 1 分钟聚合（保留 7 天），并落盘 `data/metrics.json`
- 新增网卡流量统计：读取 `/sys/class/net/<iface>/statistics`，持久化基线以跨重启累计，按日/月聚合，支持月度配额与可配置的月重置日
- 仪表盘新增体检卡：证书最近到期、备份最近状态、服务健康（nginx / PM2 异常进程 / 面板自身）、磁盘与内存水位
- 仪表盘新增趋势图：CPU / 内存 / 磁盘 / 网速，支持 1h / 24h / 7d 切换
- 新增设置项：指标保留期、流量统计网卡、月流量配额、月重置日

### 范围边界

- 做什么：采集、留存、聚合、查询、图表展示，以及供其它模块读取的指标快照
- 不做什么：不发送任何告警（由 `panel-alerts` 负责）、不做外部站点可用性探测、不引入数据库（JSON 落盘即可）、不采集 GPU / 温度等硬件传感项

## Capabilities

### New Capabilities

- `system-metrics`: 后台指标采集、环形缓冲与聚合、历史序列查询接口，以及仪表盘趋势图
- `traffic-accounting`: 网卡流量的持久化累计、日/月聚合、月配额与重置日配置
- `panel-health`: 仪表盘体检卡，汇聚证书到期、备份状态、服务健康与资源水位

### Modified Capabilities

（无）

## Impact

- 重构：`src/services/monitor.js` 拆为采集与查询职责
- 新增：`src/services/metrics.js`、`src/services/traffic.js`、`src/services/health.js`、`src/routes/metrics.js`、`src/routes/traffic.js`
- 修改：`src/routes/dashboard.js`（体检与趋势数据）、`src/services/config.js`（新设置默认值）、`src/index.js`（路由挂载、采集器启动）
- 前端：`client/src/views/Dashboard.vue`（体检卡、趋势图、区间切换）、`client/src/views/Settings.vue`（新设置项）
- 运行时数据：`data/metrics.json`、`data/traffic.json`、`data/health-cache.json`
- 无新增 npm 依赖
