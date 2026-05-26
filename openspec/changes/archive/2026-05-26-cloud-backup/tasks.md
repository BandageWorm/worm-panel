## 1. 后端核心：同步服务

- [x] 1.1 创建 `src/services/sync.js`，实现 rclone 命令封装（检测安装、执行 sync/restore、解析输出）
- [x] 1.2 实现阿里云盘 OAuth 流程：生成授权 URL → 提交 code 换取 refresh_token
- [x] 1.3 实现通过环境变量注入 rclone 配置的调用方式（RCLONE_CONFIG_*）
- [x] 1.4 实现配置读写：refresh_token、远程路径、同步历史存储到 data/config.json

## 2. 后端 API 路由

- [x] 2.1 创建 `src/routes/sync.js`，挂载 /api/sync/* 路由
- [x] 2.2 实现 GET /api/sync/status — 连接状态、容量信息、最近同步时间
- [x] 2.3 实现 POST /api/sync/auth-url — 生成阿里云盘授权链接
- [x] 2.4 实现 POST /api/sync/auth-complete — 提交 code 完成授权
- [x] 2.5 实现 POST /api/sync/disconnect — 断开连接并清除配置
- [x] 2.6 实现 POST /api/sync/backup — 手动触发备份
- [x] 2.7 实现 POST /api/sync/restore — 从云端恢复到本地
- [x] 2.8 实现 GET /api/sync/history — 查询备份历史（上限 50 条）

## 3. 笔记保存触发同步

- [x] 3.1 在 PUT /api/notes/:name 和 POST /api/notes 成功后异步调用 sync.triggerBackup()
- [x] 3.2 触发前检查：已配置阿里云盘且非正在同步中则执行，否则静默跳过

## 4. 前端页面

- [x] 4.1 创建 `client/src/views/Sync.vue` 页面组件
- [x] 4.2 实现未连接状态页：连接引导、授权按钮、授权 URL 展示
- [x] 4.3 实现已连接状态页：状态卡片、容量信息、最近同步时间
- [x] 4.4 实现操作按钮：立即备份、从云端恢复（含确认弹窗）、断开连接
- [x] 4.5 实现备份历史记录列表
- [x] 4.6 实现 rclone 未安装提示状态
- [x] 4.7 在 `client/src/router/index.js` 添加 /sync 路由和左侧导航入口

## 5. 后端集成

- [x] 5.1 在 `app.js` 中挂载 sync 路由模块
- [x] 5.2 实现 12 小时定时同步机制（server 启动后 setInterval 或 node-cron）
- [x] 5.3 服务启动时检测并恢复上一次的定时任务

## 6. 安装脚本更新

- [x] 6.1 在 `scripts/install.sh` 中添加 rclone 安装步骤（curl 下载官方二进制，类似 wrangler 安装方式）
- [x] 6.2 创建 12 小时定时同步的 crontab 或 systemd timer
- [x] 6.3 在安装脚本的目录创建步骤中确认 data/ 目录存在
