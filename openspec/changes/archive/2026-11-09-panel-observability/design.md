# Design

## Context

动机见 `proposal.md`。当前实现约束如下：

- `src/services/monitor.js` 是纯函数式即时查询，模块级变量只有 `lastRx/lastTx/lastTs` 三个用于算瞬时网速的游标，无任何留存
- 内存口径已刻意从 `/proc/meminfo` 计算（`MemTotal - MemAvailable`），与 3X-UI / htop 对齐，不能因为本次改动回退到 systeminformation 的 `mem().used`
- 项目无数据库，运行态数据一律以 JSON 落盘在 `data/`，配置通过 `config.getSettings()` 与默认值合并，老配置缺字段不会报错
- 面板以 systemd / root 运行，读 `/sys/class/net`、`acme.sh` 目录、`systemctl` 无权限障碍
- 仪表盘前端已按 `settings.dashboardRefresh`（默认 5s）轮询 `/api/dashboard`

## Goals / Non-Goals

**Goals:**

- 采样与查询解耦：采样节奏不依赖前端刷新频率，前端不访问时也有完整历史
- 单一数据源：仪表盘、趋势图、健康汇总、后续告警判定读同一份采集结果，不各自采样
- 零新增运行时依赖，零数据库迁移
- 读盘频率与文件体积可控，断电最多丢一个落盘周期

**Non-Goals:**

- 不追求高精度时序（非 Prometheus 语义），不支持任意时间点回溯查询
- 不做跨主机聚合、不做指标导出
- 不在本次引入图表库

## Decisions

### 1. 采集层独立于请求，模块化为「采集器 + 查询」

`monitor.js` 保留现有单点采集函数（含 meminfo 口径），新增 `metrics.js` 负责调度、缓冲与查询。`index.js` 启动时开启采集定时器，`SIGTERM` 时落盘。

替代方案：直接在 `/api/dashboard` 里顺便写入历史。否决原因——健康汇总和告警也想读同一份数据，绑在路由里会导致"没人开仪表盘就没有数据"。

### 2. 双层保留：1 小时明细 + 7 天 1 分钟聚合

内存中维护两个环形缓冲：5s 明细（720 点）与 1min 聚合（10080 点）。聚合点在分钟边界由该分钟内的明细求平均（速率类取平均，计数类取末值）。

替代方案：只存明细按需抽稀。否决原因——7 天 × 5s 是 12 万点，单文件 JSON 会到数十 MB，每次读盘都是灾难。

### 3. 落盘：60 秒一次，原子写

写 `data/metrics.json.tmp` 后 `rename`，避免进程被杀时留下半截 JSON。启动解析失败则重置为空序列并继续运行（spec 已要求）。

替代方案：改用 SQLite。否决原因——需要原生编译依赖（`better-sqlite3`），与"`npm install` 即可部署"的现状冲突；数据量在 JSON 可承受范围。

### 4. 抽稀在后端完成

查询接口按区间决定目标点数上限（约 240），超过则按时间桶聚合后再返回。前端只负责画，不做采样决策。

### 5. 流量统计：计数器差值 + 持久化基线

```
baseline{rx,tx}  ──持久化于 data/traffic.json──┐
                                              v
Δ = counter_now - counter_last               累加
若 Δ < 0  → 判定为主机重启，baseline = counter_now，Δ = 0
```

计费周期用 `periodKey` 表示，由 `trafficResetDay`（1-28，限制在 28 以内避免 2 月无该日）计算，例如重置日 15 → `2026-11-15 ~ 2026-12-14`。日数据保留 90 天，月数据保留 12 个周期。

网卡默认取默认路由所在网卡，排除 `lo` / `docker*` / `veth*` / `br-*`。

替代方案：用 `vnstat`。否决原因——需要额外安装与守护进程，且我们要的数据它就差一个聚合层；直接读 `/sys/class/net` 更可控。

### 6. 健康汇总：60 秒缓存 + 单飞

`health.js` 内部缓存 60s，并发请求共享同一次计算（避免仪表盘多标签页同时打穿）。单项查询各自 try/catch，失败降级为"未知"，不让一个数据源拖垮整块。

PM2 需要 `connect/list/disconnect`，开销明显大于读文件，因此与 acme 扫描一并纳入 60s 缓存；`systemctl is-active` 与 `nginx -t` 走同样的缓存周期。

### 7. 仪表盘前端分频

- 资源卡片：沿用现有 `dashboardRefresh`（默认 5s）
- 趋势图：只在进入页面、切换区间、或 30s 定时刷新时请求
- 体检卡：消费 §6 的缓存结果，随资源卡片一起刷新即可（后端不会重算）

### 8. 趋势图手绘 SVG，不引入图表库

四类指标、折线加面积、hover 显示数值即可，不需要缩放与坐标系交互。单个 `TrendChart.vue` 约 150 行可控。

替代方案：ECharts 按需引入（core + LineChart + Grid + Tooltip）。否决原因——为一张折线图引入约 200KB 依赖并需要在 Vite 里做手动 chunk，收益不匹配；若后续真需要缩放再换。

### 9. 新增设置项走现有 `settings` 合并机制

`config.DEFAULT_SETTINGS` 增加 `metricsRetentionDays`（1-30）、`trafficIfaces`（逗号分隔字符串，空 = 自动）、`trafficQuotaGB`（0 = 不设配额）、`trafficResetDay`（1-28）。`routes/settings.js` 的 `SETTING_LIMITS` 同步加入校验，不新建配置页。

## Risks / Trade-offs

- **落盘周期内断电/被 kill 会丢最多 60s 明细** → 可接受；聚合层数据不丢（每次落盘都包含）。代价是牺牲了"每样本必落盘"的强持久性。
- **`data/metrics.json` 随保留期增长**（约 1-2 MB 上限） → 写入前按保留期裁剪，并设硬上限条目数，超限丢弃最旧点。
- **`/sys/class/net` 计数器在多网卡/容器环境下口径模糊** → 默认只统计默认路由网卡，且界面明确标注"近似值"，避免与云厂商账单对不上时被误认为 bug。
- **健康汇总读 `acme.sh` 可能慢** → 缓存 60s 且给单次执行设 5s 超时，超时按"未知"处理。
- **采样器与路由同时读 `monitor.js` 时可能重复调用 systeminformation** → 采集器改为唯一调用方，路由只读缓存快照；仪表盘首次请求若缓存未就绪则现场采集一次并回填。
- **`process.exit(0)`（设置页重启按钮）会跳过异步落盘** → 在 `beforeExit`/`SIGTERM` 中做同步落盘（`writeFileSync`），不依赖异步链路。

## Migration Plan

1. 部署后首次启动自动创建 `data/metrics.json`、`data/traffic.json`，无需人工迁移
2. 旧 `config.json` 缺少新设置项时由 `getSettings()` 合并默认值，不需要写回
3. 回滚：移除新路由挂载与采集器启动即可，仪表盘退回四张资源卡；新增的 JSON 文件可保留不删（不影响旧逻辑）
