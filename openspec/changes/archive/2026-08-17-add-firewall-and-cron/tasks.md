## 1. 防火墙后端实现

- [x] 1.1 创建 `src/services/firewall.js`：封装 ufw 命令（status、rules 解析、add、delete、enable、disable），包含 sudo 自动重试和面板端口保护逻辑
- [x] 1.2 创建 `src/routes/firewall.js`：实现防火墙 REST API（GET status、GET rules、POST rules、DELETE rules/:id、POST enable、POST disable）
- [x] 1.3 在 `src/index.js` 中挂载防火墙路由 `/api/firewall`

## 2. 计划任务后端实现

- [x] 2.1 创建 `src/services/cron.js`：封装 crontab 解析/写入（读取、标识面板任务、CRUD 操作、启用/禁用）、互斥锁、执行历史读写
- [x] 2.2 创建 `src/routes/cron.js`：实现计划任务 REST API（GET jobs、POST jobs、PUT jobs/:id、DELETE jobs/:id、POST jobs/:id/run、GET jobs/:id/history）
- [x] 2.3 在 `src/index.js` 中挂载计划任务路由 `/api/cron`

## 3. 防火墙前端页面

- [x] 3.1 创建 `client/src/views/FirewallManager.vue`：防火墙状态开关、规则列表表格（端口/协议/动作/来源/操作）、面板端口锁定标识、SSH 删除二次确认、添加规则对话框
- [x] 3.2 在 `client/src/router/index.js` 中添加 `/firewall` 路由
- [x] 3.3 在 `client/src/layouts/MainLayout.vue` 侧边栏添加防火墙菜单项（位于终端之后、Nginx 之前）

## 4. 计划任务前端页面

- [x] 4.1 创建 `client/src/views/CronManager.vue`：任务列表表格（状态/名称/周期/命令/操作）、非面板任务只读标记、立即执行按钮
- [x] 4.2 实现添加/编辑任务对话框：任务名称、周期选择器（快捷模式 + 高级 cron 表达式）、命令输入、cron 表达式预览
- [x] 4.3 实现执行历史抽屉/对话框：历史记录列表（时间/状态/耗时）、展开查看 stdout/stderr
- [x] 4.4 在 `client/src/router/index.js` 中添加 `/cron` 路由
- [x] 4.5 在 `client/src/layouts/MainLayout.vue` 侧边栏添加计划任务菜单项（位于 SSL 证书之后、PM2 之前）

## 5. 集成与收尾

- [x] 5.1 创建 `data/cron-history/` 目录，确保应用启动时自动创建
- [x] 5.2 在 `client/src/api/index.js` 中添加防火墙和计划任务相关 API 调用方法（如需要）
- [x] 5.3 前端构建验证：`cd client && npm run build` 确保无报错
