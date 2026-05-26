## 1. 后端服务层

- [x] 1.1 创建 `src/services/gitworker.js` — 实现 `getProjects()`、`saveProjects()`、`deploy()`、`removeProject()` 函数
- [x] 1.2 `deploy()` 实现 git clone + npm install + pm2 start miniflare 完整流程
- [x] 1.3 `removeProject()` 实现 pm2 stop/delete + 删除本地文件 + 移除记录

## 2. 后端路由

- [x] 2.1 创建 `src/routes/gitworker.js` — POST /deploy、GET /projects、DELETE /projects/:name
- [x] 2.2 在 `src/index.js` 中注册 `/api/gitworker` 路由

## 3. 数据文件

- [x] 3.1 创建 `data/workers.json`，初始内容为 `[]`

## 4. 前端 PM2 页面

- [x] 4.1 在 `Pm2Manager.vue` 进程列表 tab 添加"从 GitHub 部署 Worker"按钮
- [x] 4.2 实现部署对话框（仓库地址、项目名称、入口文件、分支、端口表单）
- [x] 4.3 实现部署成功后的进程列表刷新
- [x] 4.4 在进程操作栏添加"删除 Worker"按钮（仅对已部署项目显示）

## 5. 验证

- [x] 5.1 启动面板，进入 PM2 页面确认部署按钮和对话框正常
- [x] 5.2 部署一个测试 Worker 项目，确认进程出现在列表中
- [x] 5.3 确认删除功能正常清理进程和文件
