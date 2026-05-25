# PM2 Manager — 实现任务

## Task 1: PM2 服务层 [x]

- [x] 集成 pm2 npm 包
- [x] 实现 pm2 连接、进程列表、重启/停止/重载
- [x] 日志读取（文件日志 + CLI 回退）
- [x] ecosystem.config.js 读写

## Task 2: PM2 API [x]

- [x] GET /api/pm2/processes（进程列表）
- [x] POST /api/pm2/restart/:name
- [x] POST /api/pm2/stop/:name
- [x] POST /api/pm2/reload/:name
- [x] GET /api/pm2/logs/:name
- [x] GET /api/pm2/config
- [x] PUT /api/pm2/config

## Task 3: 前端 PM2 管理页 [x]

- [x] 进程列表表格（名称、状态、CPU、内存、运行时间）
- [x] 进程操作按钮（重启、停止、重载）
- [x] 日志查看面板
- [x] 配置编辑器
