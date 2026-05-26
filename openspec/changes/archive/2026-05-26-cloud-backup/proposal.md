## Why

当前服务器为临时租用实例，随时可能释放或丢失。笔记数据存储在本地 data/notes/ 目录，没有任何外部备份机制。需要将笔记数据自动同步到阿里云盘，确保在服务器丢失时可以从云端恢复。

## What Changes

- 新增「云备份」独立导航菜单模块
- 集成 rclone aliyundrive 后端，支持阿里云盘作为备份目标
- 实现 manual OAuth 认证流程（浏览器授权 → 贴回 code），适应无头服务器场景
- 每次保存笔记时自动后台触发同步，每 12 小时定时同步兜底
- 支持从云端恢复到本地（覆盖本地文件）
- 配置信息存储于 data/config.json
- 前端提供连接/断开、备份状态、历史记录查询、立即备份、从云端恢复等操作
- scripts/install.sh 更新：安装 rclone、配置定时同步任务

## Capabilities

### New Capabilities
- `sync`: 云备份功能，包括阿里云盘连接管理、手动/自动备份、恢复操作、备份历史记录

### Modified Capabilities
- `notes`: 笔记保存后自动触发后台备份

## Impact

- **新增文件**: src/services/sync.js（同步逻辑）、src/routes/sync.js（API 路由）
- **修改文件**: app.js（挂载新路由）、client/src/router/index.js（添加导航）、client/src/views/Sync.vue（新页面）、data/config.json schema 扩展、scripts/install.sh（安装 rclone）
- **新增依赖**: rclone（外部工具，非 npm 包）
