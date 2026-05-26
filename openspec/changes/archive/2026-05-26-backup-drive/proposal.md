## Why

云备份目前仅同步 notes 目录到 WebDAV，缺少一个通用的本地备份空间用于临时或手动备份任意文件。用户需要一个独立于 WebDAV 同步的「备份盘」，支持拖拽上传、下载、删除、重命名和文件夹管理，并且每次修改自动同步到云端。

## What Changes

- 在云备份页面（Sync.vue）新增「备份盘」卡片，位于状态卡片和历史表格之间
- 新增本地存储目录 `data/drive/`，独立于 notes 和备份历史
- 新增完整的文件管理功能：拖拽/点击上传、下载、删除、重命名、新建文件夹、目录导航
- 每次写操作（上传/删除/重命名/新建文件夹）后自动触发 rclone 同步到 WebDAV 的 `worm-panel-backup/drive/` 目录
- 上传单文件大小限制 500MB

## Capabilities

### New Capabilities
- `backup-drive`: 本地备份盘管理，包含文件浏览、上传、下载、删除、重命名、新建文件夹，以及自动同步到 WebDAV

### Modified Capabilities

- <!-- 无修改，备份盘是全新独立功能 -->

## Impact

- **后端新增 API 路由**: `src/routes/drive.js`，操作 `data/drive/` 目录
- **前端修改**: `client/src/views/Sync.vue` 新增备份盘卡片组件
- **依赖**: multer 已安装，无需新增依赖
- **存储**: `data/drive/` 目录首次使用时自动创建
- **rclone**: 复用现有 sync 服务的 WebDAV 连接配置进行同步
