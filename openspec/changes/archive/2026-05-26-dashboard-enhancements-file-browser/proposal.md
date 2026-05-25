## Why

面板在服务器文件管理和终端操作方面存在空白，用户需要频繁 SSH 登录服务器进行日常运维。将文件浏览和 Web 终端集成到仪表盘，配合现有 SSL/3X-UI 模块的优化，可以减少运维心智负担，提升面板实用性。

## What Changes

1. **SSL 证书管理优化**：添加证书删除功能、一键自动续期所有证书、去掉"配置 Nginx"按钮（基于 acme.sh 内置的 renewal 机制并增加手动触发入口）
2. **记事本字体调整**：编辑区域等宽字体从 `'Courier New', Consolas, monospace` 改为 `Consolas, 'Source Code Pro', monospace`
3. **3X-UI 页面简化**：移除"详细信息"卡片，将安装路径展示在顶部状态卡片（替换版本卡片）
4. **仪表盘新增文件浏览器**：在仪表盘快捷入口下方增加文件浏览面板，支持目录树浏览、文件上传、文件下载
5. **文件浏览器下方集成终端**：在文件浏览器下方增加一个基于 WebSocket 的 SSH 终端，支持在浏览器直接执行 shell 命令

## Capabilities

### New Capabilities
- `file-browser`: 文件浏览管理，支持目录遍历、文件上传/下载/删除、新建目录
- `terminal`: 基于 WebSocket 的浏览器端 SSH 终端，在文件浏览器下方嵌入式运行

### Modified Capabilities
- `ssl`: 删除证书（DELETE /api/ssl/cert/:domain）、全部续期（POST /api/ssl/renew-all）；移除"配置到 Nginx"相关功能（删除 POST /api/ssl/apply-to-nginx 的 UI 入口，保留后端代码）
- `xui`: 页面 UI 调整，移除详细信息卡片，将安装路径显示在顶部状态区
- `notes`: 无 spec 级变更（仅 CSS 字体调整，不影响接口行为）

## Impact

- **后端新增**：`src/routes/files.js`（文件浏览 API）、`src/services/files.js`（文件系统操作）、WebSocket 终端服务（集成在 `app.js` 或独立模块）
- **后端修改**：`src/routes/ssl.js` 新增删除和全部续期路由、`src/services/acme.js` 新增对应方法
- **前端新增**：`FileBrowser.vue` 组件（内嵌在 Dashboard）、`Terminal.vue` 组件
- **前端修改**：`Dashboard.vue` 集成两个新组件、`SslManager.vue` 调整按钮、`XuiManager.vue` 简化 UI、`NotesManager.vue` 字体
- **新依赖**：后端 `ssh2`、`ws`（或 `express-ws`）；前端 `xterm`、`xterm-addon-fit`、`multer`（文件上传）
