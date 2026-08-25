## Why

面板目前管理进程依赖 PM2，但服务器上大量核心服务（nginx、MySQL、Redis、面板自身等）由 systemd 管理。日常需要 SSH 到服务器执行 `systemctl restart xxx`，缺少可视化管理入口。增加 Systemd 管理模块可以在面板内直接查看所有系统服务状态并执行启停操作，减少 SSH 操作频率。

## What Changes

- 新增 Systemd 管理页面，展示所有 systemd service 列表
- 支持按状态筛选、关键字搜索，运行中的服务排在前面
- 支持对服务执行 start / stop / restart / reload 操作
- 支持 enable / disable 开机自启配置
- 支持查看单个服务的详细状态信息（PID、内存、启动时间等）
- 支持查看服务最近日志（journalctl 最近 100 行）
- worm-panel.service 自身受保护：允许重启（需二次确认），禁止停止和禁用

## Capabilities

### New Capabilities

- `systemd-manager`: Systemd 服务管理 — 服务列表展示、状态筛选、启停操作、开机自启管理、服务详情与日志查看

### Modified Capabilities

无

## Impact

- 新增后端路由 `src/routes/systemd.js` + 服务层 `src/services/systemd.js`
- 新增前端页面 `client/src/views/SystemdManager.vue`
- 新增前端 API 模块
- 路由注册：`src/index.js` 挂载新路由、`client/src/router/index.js` 注册页面
- 侧边栏导航新增入口
- 后端依赖：无新 npm 包，纯 child_process 调用 systemctl / journalctl
- 需要 sudo 权限执行 systemctl 操作（与现有 nginx 模块处理方式一致）
