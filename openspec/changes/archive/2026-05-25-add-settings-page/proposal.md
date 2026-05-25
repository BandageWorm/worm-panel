## Why

面板目前缺少统一的设置页面，修改端口、域名、面板模式等配置需要直接编辑 `data/config.json` 或重跑安装脚本。用户需要一个直观的界面来查看和修改这些常用设置，方便日常运维。

## What Changes

- 新增 `GET /api/settings` 和 `PUT /api/settings` API，用于读取和修改面板配置
- 新增 `POST /api/settings/restart` API，用于重启面板服务
- 新建系统设置页面（替换当前指向 Placeholder.vue 的 /settings 路由），包含：
  - 基本设置：面板端口、运行模式（standalone/proxy）、绑定域名
  - 安全设置：修改管理员密码
  - 操作提示：修改 mode/port 后提示需重启面板，并提供重启按钮
- 后端注册 settings 路由至 Express 应用

## Capabilities

### New Capabilities
- `panel-settings`: 面板系统设置，包括模式切换、端口修改、域名绑定、密码更改

### Modified Capabilities

<!-- 无现有 specs 需要修改 -->

## Impact

- **后端新增**: `src/routes/settings.js` — Settings API 路由
- **后端修改**: `src/index.js` — 注册 settings 路由
- **前端新增**: `client/src/views/Settings.vue` — 设置页面组件
- **前端修改**: `client/src/router/index.js` — /settings 指向新组件而非 Placeholder.vue
- **配置变更**: `data/config.json` — 字段不变，复用现有字段
