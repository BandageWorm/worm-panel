## 1. 记事本字体调整

- [x] 1.1 将 NotesManager.vue 中 `.note-textarea :deep(.el-textarea__inner)` 的 `font-family` 从 `'Courier New', Consolas, monospace` 改为 `Consolas, 'Source Code Pro', monospace`

## 2. 3X-UI 页面简化

- [x] 2.1 修改 XuiManager.vue：删除第 87-102 行的"详细信息"el-card 整块
- [x] 2.2 修改 XuiManager.vue：将"版本" stat card 改为显示"安装路径"，内容绑定从 `status.version` 改为 `status.installPath`

## 3. SSL 证书管理 — 后端

- [x] 3.1 在 src/services/acme.js 中添加 `renewAllCerts()` 方法（调用 `acme.sh --renew-all`，成功后 reload nginx）
- [x] 3.2 在 src/services/acme.js 中添加 `deleteCert(domain)` 方法（调用 `acme.sh --remove -d <domain>`，清理 ~/.acme.sh 对应目录）
- [x] 3.3 在 src/routes/ssl.js 中添加 `POST /renew-all` 路由（调用 renewAllCerts）
- [x] 3.4 在 src/routes/ssl.js 中添加 `DELETE /cert/:domain` 路由（调用 deleteCert）

## 4. SSL 证书管理 — 前端

- [x] 4.1 修改 SslManager.vue：在表格操作列中去掉"配置 Nginx"按钮和对应的 `showApplyDialog`/`handleApply` 方法
- [x] 4.2 修改 SslManager.vue：删除"配置 Nginx"对话框（showApplyDialogBox 相关代码）
- [x] 4.3 修改 SslManager.vue：在表头卡片添加"全部续期"按钮，调用 `POST /ssl/renew-all`
- [x] 4.4 修改 SslManager.vue：在表格操作列添加"删除"按钮，调用 `del('/ssl/cert/' + row.domain)` 带确认对话框

## 5. 文件浏览 — 后端

- [x] 5.1 创建 src/services/files.js，实现目录列表（`listDir(path)`）、文件信息获取（`getFileInfo(path)`）、文件删除（`deleteItem(path)`）、目录创建（`mkdir(path)`）功能，含路径穿越防护（拒绝 `..`）
- [x] 5.2 创建 src/routes/files.js，实现 `GET /api/files`（列目录）、`GET /api/files/download`（文件下载返回流）、`POST /api/files/upload`（multipart 上传）、`DELETE /api/files`（删除）、`POST /api/files/mkdir`（新建目录）
- [x] 5.3 在 src/index.js 注册 `/api/files` 路由（`app.use('/api/files', authMiddleware, require('./routes/files'))`）
- [x] 5.4 安装 multer 依赖（`npm install multer`）用于文件上传处理

## 6. 文件浏览 — 前端

- [x] 6.1 新建 client/src/components/FileBrowser.vue：面包屑导航 + 文件列表表格 + 上传按钮 + 新建目录按钮 + 下载/删除操作列
- [x] 6.2 实现文件列表渲染：列显示名称、大小、修改时间、类型，目录可双击进入，面包屑可点击返回
- [x] 6.3 实现上传功能：文件选择对话框 → POST /api/files/upload FormData，上传后刷新列表
- [x] 6.4 实现下载功能：点击下载按钮 → window.open /api/files/download?path=xxx
- [x] 6.5 实现删除功能：确认对话框 → DELETE /api/files，成功后刷新列表
- [x] 6.6 实现新建目录：弹出输入框 → POST /api/files/mkdir，成功后刷新列表
- [x] 6.7 修改 Dashboard.vue：在快捷入口 card 下方嵌入 FileBrowser 组件

## 7. Web 终端 — 后端

- [x] 7.1 安装依赖：`npm install ws node-pty`
- [x] 7.2 创建 src/services/terminal.js：导出 `createTerminal(ws, token)` 函数，验证 JWT → spawn node-pty bash 进程 → 绑定 ws 消息（input/resize）→ 断开时 kill pty
- [x] 7.3 修改 app.js：引入 ws 库，在 HTTP server 上附加 upgrade handler，路径 `/api/terminal` 的 WS 请求调用 createTerminal
- [x] 7.4 导出 HTTP server（目前是 `app.listen` 需要改为 `server.listen` 以共享端口）

## 8. Web 终端 — 前端

- [x] 8.1 安装前端依赖：`cd client && npm install xterm xterm-addon-fit`
- [x] 8.2 新建 client/src/components/Terminal.vue：基于 xterm.js 的终端组件，通过 WebSocket 连接 `/api/terminal?token=<jwt>`，绑定数据收发、resize 事件
- [x] 8.3 实现终端断线自动重连逻辑（3s 间隔）
- [x] 8.4 实现终端区域折叠/展开功能
- [x] 8.5 修改 Dashboard.vue：在 FileBrowser 下方嵌入 Terminal 组件，传递 JWT token

## 9. 前端构建验证

- [x] 9.1 执行 `cd client && npm run build` 验证前端编译无错误
- [x] 9.2 检查 public/ 目录生成的前端静态文件正常
