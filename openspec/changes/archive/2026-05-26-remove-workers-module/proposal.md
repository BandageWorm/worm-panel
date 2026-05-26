## Why

Workers 模块当前实现的是通过 wrangler 将项目部署到 Cloudflare 的流程。实际使用中，Worker 项目是 Cloudflare Workers 原生代码（Web Worker API），不需要部署到 Cloudflare，而是通过 miniflare 在 VPS 本地运行，由 PM2 守护进程。面板已有 PM2 管理模块，可以直接复用。因此删除独立的 Workers 模块，减少维护成本。

## What Changes

- **删除** Workers 模块全部代码（后端路由、服务层、前端页面）
- **删除** Workers 菜单项和路由注册
- **删除** config.json 中的 `cloudflareApiToken` 和 `workers` 配置项
- **删除** 安装/部署脚本中 wrangler 安装和 `data/workers/` 目录创建逻辑
- **归档** `openspec/specs/workers/spec.md` 规格文档

## Capabilities

### New Capabilities

无新能力引入。

### Modified Capabilities

无规格层面的行为变更。`workers` 能力被移除，不再维护对应的规格文档。

## Impact

- **删除文件**: `src/routes/workers.js`、`src/services/workers.js`、`client/src/views/WorkersManager.vue`
- **修改文件**: `src/index.js`（移除路由挂载）、`client/src/router/index.js`（移除路由）、`client/src/layouts/MainLayout.vue`（移除菜单）、`src/services/config.js`（清理配置项）、`scripts/install.sh` 和 `scripts/deploy.sh`（清理目录创建和 wrangler 安装）
- **归档**: `openspec/specs/workers/spec.md`
- **用户影响**: Workers 页面消失，Worker 项目通过 SSH 手动 `pm2 start miniflare` 管理，或使用已有的 PM2 页面查看进程状态
