## 1. 后端 — Drive 路由与文件操作

- [x] 1.1 创建 `src/routes/drive.js`，实现文件列表 API（GET /api/drive/list），带路径安全校验
- [x] 1.2 实现文件上传 API（POST /api/drive/upload），配置 multer 限制 500MB，重名自动加时间戳
- [x] 1.3 实现文件下载 API（GET /api/drive/download），流式响应
- [x] 1.4 实现文件/文件夹删除 API（DELETE /api/drive/），支持递归删除文件夹
- [x] 1.5 实现重命名 API（PUT /api/drive/rename），冲突返回 409
- [x] 1.6 实现新建文件夹 API（POST /api/drive/mkdir），冲突返回 409

## 2. 后端 — Drive 同步服务

- [x] 2.1 在 `src/services/sync.js` 中新增 `syncDrive()` 方法，将 `data/drive/` 同步到 `syncremote:worm-panel-backup/drive/`
- [x] 2.2 在 drive 路由的写操作后异步调用 `syncDrive()`，失败仅日志记录
- [x] 2.3 在 GET /api/drive/list 响应中附加 isSyncing 状态字段，指示是否有同步进行中

## 3. 后端 — 注册路由

- [x] 3.1 在 `src/index.js` 中注册 `/api/drive` 路由
- [x] 3.2 确保 `data/drive/` 目录在应用启动时自动创建（复用 `ensureDataDir` 或 drive 路由初始化时）

## 4. 前端 — 备份盘卡片组件

- [x] 4.1 在 `client/src/views/Sync.vue` 的状态卡片和历史表格之间插入备份盘卡片区域
- [x] 4.2 实现拖拽/点击上传区域（el-upload drag 模式），自动上传到当前目录
- [x] 4.3 实现文件列表展示（文件名、大小、修改时间），带文件夹导航和面包屑
- [x] 4.4 实现每行操作按钮：下载、删除（确认弹窗）、重命名（行内编辑）
- [x] 4.5 实现「新建文件夹」按钮和对话框
- [x] 4.6 实现响应式布局（手机端适配）
- [x] 4.7 未连接 WebDAV 时显示本地模式提示

## 5. 构建与验证

- [x] 5.1 前端构建：`cd client && npm run build` 确认编译无报错
- [ ] 5.2 启动应用验证：文件上传/下载/删除/重命名/新建文件夹全流程测试（需部署后验证）
- [ ] 5.3 验证路径穿越防护（手动构造恶意路径请求）（需部署后验证）
- [ ] 5.4 验证同步触发：上传后检查 WebDAV 端文件同步状态（需部署后验证）
