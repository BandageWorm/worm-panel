# Proposal

## Why

排障时最费时间的三件事在面板里都缺入口：不知道某端口被谁占用、想翻 nginx/journald 日志得开终端手工 tail、GitWorker 的后端接口与规格早就存在但前端没有任何入口（`/api/gitworker` 已挂载，`worker` 项目列表接口可用，界面上却完全找不到）。

## What Changes

- 新增端口与进程视图：解析 `ss -tlnp` 展示监听端口及其归属进程，`ps` 展示按 CPU/内存排序的进程列表，支持终止进程（保护清单 + 二次确认）
- 新增统一日志中心：以"日志源"为抽象，支持面板（journald `worm-panel`）、nginx（`/var/log/nginx/*.log` 及站点自定义 `access_log`）、PM2 进程日志，支持选择源、tail N 行、关键字过滤、自动刷新
- 补全 GitWorker 前端：部署入口保留在 PM2 页面内（不新增独立页面），补齐表单校验、部署中状态与超时提示，并把已部署 Worker 项目与 PM2 进程状态关联展示（运行中 / 已停止 / 未运行），支持从列表直接删除项目

### 范围边界

- 做什么：只读观测 + 有限的控制动作（终止进程、部署/删除 Worker 项目）、日志按需读取
- 不做什么：不做全文索引与日志归档、不做 Docker 管理、不做端口变更历史追踪、不新增 Worker 独立页面、不改造 GitWorker 为异步任务队列与实时日志流（部署仍为同步阻塞，前端以长超时呈现"部署中"态）

## Capabilities

### New Capabilities

- `port-process-inspector`: 监听端口与进程列表的查询、交叉引用与受保护的进程终止
- `log-center`: 日志源注册、按源读取尾部内容、关键字过滤与自动刷新

### Modified Capabilities

- `gitworker`: 在保留 PM2 页面入口的前提下，补充表单校验、部署耗时反馈，以及已部署项目与 PM2 进程运行状态的关联展示要求

## Impact

- 新增：`src/services/ports.js`、`src/services/logs.js`、`src/routes/ports.js`、`src/routes/logs.js`、`client/src/views/PortManager.vue`、`client/src/views/LogCenter.vue`
- 修改：`src/index.js`（路由挂载）、`client/src/router/index.js`、`client/src/layouts/MainLayout.vue`（仅新增两项菜单，保持平铺不分组）、`src/services/gitworker.js`（项目状态与 PM2 合并）、`src/routes/gitworker.js`、`client/src/views/Pm2Manager.vue`（Worker 部署表单校验、耗时反馈、已部署项目状态展示）
- 现有可复用：`src/services/pm2.js` 的 `getLogs`、`src/services/systemd.js` 的服务日志做法
- 无新增 npm 依赖（`ss` / `ps` / `journalctl` 均为系统命令）
