## Why

之前删除了独立的 Workers 模块（wrangler + Cloudflare 部署）。用户需要从面板直接输入 GitHub 仓库地址，自动 clone 并使用 miniflare + PM2 在 VPS 本地运行 Worker 项目。这样既能保留原来"一键部署"的便利性，又改用本地模拟运行的方式，进程可直接在现有 PM2 页面管理。

## What Changes

- **新增** `src/services/gitworker.js` — git clone + pm2 start miniflare 的业务逻辑
- **新增** `src/routes/gitworker.js` — deploy/list/remove 三个 API 端点
- **修改** `src/index.js` — 注册 `/api/gitworker` 路由
- **修改** `client/src/views/Pm2Manager.vue` — 在进程列表 tab 添加"从 GitHub 部署 Worker"按钮 + 对话框
- **新增** `data/workers.json` — 部署项目记录持久化

## Capabilities

### New Capabilities

- `gitworker`: 从 GitHub 仓库部署 Cloudflare Worker 项目到本地 miniflare + PM2 运行，包含项目注册、部署、删除功能

### Modified Capabilities

无。

## Impact

- **新增文件**: `src/services/gitworker.js`、`src/routes/gitworker.js`、`data/workers.json`
- **修改文件**: `src/index.js`（路由注册）、`client/src/views/Pm2Manager.vue`（UI 扩展）
- **用户影响**: PM2 页面新增部署入口，部署后的进程自动出现在进程列表中，可用现有 PM2 功能管理（重启/停止/日志）
