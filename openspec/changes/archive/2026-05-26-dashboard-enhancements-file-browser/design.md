## Context

当前 Worm Panel 仪表盘仅展示系统概览和快捷入口，缺少文件管理和远程终端能力。用户需要 SSH 登录服务器进行文件操作和命令执行。同时 SSL 和 3X-UI 管理页面存在冗余操作和 UI 拥挤问题。

后端使用 Express 单端口服务，前端 Vue 3 + Element Plus，静态文件由后端托管。暂无 WebSocket 支持。

## Goals / Non-Goals

**Goals:**
- 在仪表盘页面嵌入文件浏览器和终端，保持单页面操作流
- 文件浏览器支持：目录树浏览、面包屑导航、文件上传/下载/删除、新建目录
- 终端通过 WebSocket + node-pty 实现本地 bash shell，无需 SSH 凭证管理
- SSL 证书管理增加删除和全部续期，去掉"配置 Nginx"入口
- 3X-UI 页面简化，移除详细信息卡片
- 记事本编辑器字体改为 Consolas/Source Code Pro

**Non-Goals:**
- 不实现文件编辑（后续可考虑）
- 不实现文件权限修改
- 不实现多用户 SSH 会话管理
- 不实现文件拖拽上传（仅按钮选择）
- 不实现终端布局调整（固定在文件浏览器下方）

## Decisions

### 1. 终端实现方式：node-pty 本地 shell vs SSH2 远程连接

**方案 A：node-pty + WebSocket（选择）**
- 在服务器端 spawn `/bin/bash` 进程，通过 WebSocket 转发输入输出
- 优势：无需 SSH 凭证配置，继承面板进程的权限，实现简单
- 劣势：终端权限与面板运行用户一致；需要编译原生模块

**方案 B：ssh2 连接 localhost**
- 使用 ssh2 库通过 SSH 连接到 127.0.0.1:22
- 优势：独立登录会话，可指定用户
- 劣势：需要存储 SSH 凭证，额外的配置复杂度

**结论**：选择方案 A。面板通常以 root 或具有 sudo 权限的用户运行，node-pty 直接 spawn shell 更简洁。WS 连接建立时自动启动 bash，断开时 kill 进程。

### 2. WebSocket 库选择：ws vs express-ws

**选择 `ws` 库**，在 `app.js` 中通过 `server.on('upgrade', ...)` 手动处理。原因是 express-ws 对 Express 的路由入侵较强，ws 更轻量且与现有 Express 架构配合良好（`app.js` 中已经创建了 `http.createServer` 的类似模式）。

### 3. 文件浏览 API 设计

采用 RESTful 风格，路径通过查询参数传递：
- `GET /api/files?path=/` — 列出目录内容
- `GET /api/files/download?path=/xxx` — 下载文件（返回文件流）
- `POST /api/files/upload` — 上传文件（multipart/form-data，保留目标目录参数）
- `DELETE /api/files?path=/xxx` — 删除文件或空目录
- `POST /api/files/mkdir` — 新建目录

路径安全：校验绝对路径，拒绝包含 `..` 的路径，限制在 `/` 下。

### 4. 文件浏览器在前端的集成方式

作为 Dashboard.vue 中的一个独立 card 区域，放在"快捷入口"下方。内部使用 Element Plus 的 Table 组件展示文件和目录列表，面包屑导航显示当前路径，顶部工具栏提供上传、新建目录按钮。

### 5. SSL 删除证书

acme.sh 删除命令：`acme.sh --remove -d <domain>`，删除后还需清理 ~/.acme.sh 中对应的目录。同时检查 Nginx 中是否正在使用该证书（通过 sites-enabled 中的配置），给出提示。

### 6. 3X-UI 安装路径展示

顶部 stat card 原本第 4 列显示"版本"，改为显示"安装路径"，内容展示 `status.installPath || '--'`。删除整个"详细信息"卡片区域。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| node-pty 在 Windows 开发环境不可用 | 开发时使用 fallback mock 或仅在 WSL2 测试；生产部署在 Ubuntu 无此问题 |
| WebSocket 端口与 HTTP 端口冲突 | ws 复用 HTTP 端口（`server.on('upgrade')`），无需额外端口 |
| 文件浏览列出根目录可能卡顿 | 前端默认打开 `/root` 或 `/` 时设置 3s 超时，不递归遍历 |
| 终端进程残留 | WS 断开时强制 kill pty 进程，加 5s 超时兜底 |
| 终端无认证 | 复用已有 JWT：WS 连接时在 URL 传 token，服务端验证 |
| 用户通过终端执行危险命令 | 终端权限与面板进程一致，属已知风险，面板已有免责声明（基础防护） |
