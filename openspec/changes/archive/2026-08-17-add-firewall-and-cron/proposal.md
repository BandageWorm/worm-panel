## Why

面板目前缺少服务器安全和定时任务管理能力。防火墙规则需要 SSH 手动操作 ufw，计划任务需要手动编辑 crontab，这两项都是服务器日常运维的高频操作，应纳入面板可视化管理。

## What Changes

- 新增防火墙管理模块：可视化管理 ufw 规则（查看状态、添加/删除规则、启用/关闭防火墙）
- 新增计划任务模块：可视化管理 crontab 定时任务（CRUD、立即执行、执行历史记录）
- 侧边栏新增两个导航入口，调整菜单顺序

### 模块边界

**防火墙模块做什么：**
- ufw 规则的增删查、状态开关
- 面板端口保护（不允许删除面板自身端口规则）
- SSH 端口删除二次确认

**防火墙模块不做什么：**
- 不管理 iptables 底层规则
- 不支持复杂的转发/NAT 配置
- 不做入侵检测

**计划任务模块做什么：**
- crontab 任务的增删改查
- 快捷周期选择 + 自定义 cron 表达式
- 手动立即执行任务
- 保留每个任务最近 50 条执行历史

**计划任务模块不做什么：**
- 不管理非面板创建的 crontab 条目（只读展示）
- 不支持秒级调度
- 不做任务依赖编排

## Capabilities

### New Capabilities

- `firewall`: 防火墙/端口管理 — 基于 ufw 的规则管理、状态控制、安全保护
- `cron`: 计划任务管理 — crontab 可视化管理、立即执行、执行历史记录

### Modified Capabilities

（无已有能力需要修改）

## Impact

- 后端新增文件：`src/routes/firewall.js`、`src/services/firewall.js`、`src/routes/cron.js`、`src/services/cron.js`
- 前端新增文件：`client/src/views/FirewallManager.vue`、`client/src/views/CronManager.vue`
- 修改文件：`src/index.js`（挂载新路由）、`client/src/router/index.js`（新增页面路由）、`client/src/layouts/MainLayout.vue`（侧边栏菜单调整）
- 新增数据目录：`data/cron-history/`（存储执行历史 JSONL 文件）
- 系统依赖：服务器需已安装 ufw、crontab（Ubuntu 标配，无需额外安装）
