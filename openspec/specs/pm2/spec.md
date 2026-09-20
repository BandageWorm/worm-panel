## Purpose

在面板中提供 PM2 进程的可视化管理能力，支持进程列表查看、启停与重启操作、ecosystem 配置编辑及日志查看。

## Requirements

### Requirement: PM2 进程管理

系统 SHALL 集成 PM2 API 查看和管理 Node.js 进程。

#### Scenario: 获取进程列表
- **WHEN** 已认证用户发送 GET /api/pm2/processes
- **THEN** 系统返回进程列表（名称、PID、状态、CPU、内存、运行时间、重启次数）

### Requirement: 进程操作

系统 SHALL 支持重启、停止、重载 PM2 进程。

#### Scenario: 重启进程
- **WHEN** 已认证用户发送 POST /api/pm2/restart/:name
- **THEN** 系统执行 pm2 restart 并返回结果

#### Scenario: 停止进程
- **WHEN** 已认证用户发送 POST /api/pm2/stop/:name
- **THEN** 系统执行 pm2 stop 并返回结果

#### Scenario: 重载进程
- **WHEN** 已认证用户发送 POST /api/pm2/reload/:name
- **THEN** 系统执行 pm2 reload 并返回结果

### Requirement: PM2 日志查看

系统 SHALL 支持查看 PM2 进程的最近日志。

#### Scenario: 获取进程日志
- **WHEN** 已认证用户发送 GET /api/pm2/logs/:name
- **THEN** 系统返回进程最近 N 行日志

### Requirement: PM2 配置管理

系统 SHALL 支持读取和编辑 ecosystem.config.js 配置。

#### Scenario: 读取配置
- **WHEN** 已认证用户发送 GET /api/pm2/config
- **THEN** 系统返回 ecosystem.config.js 文件内容

#### Scenario: 更新配置
- **WHEN** 已认证用户发送 PUT /api/pm2/config，携带配置内容
- **THEN** 系统写入 ecosystem.config.js 并自动 reload PM2

### Requirement: PM2 管理页面 UI

系统 SHALL 在 /#/pm2 提供 PM2 管理页面。

#### Scenario: 查看进程列表
- **WHEN** 已认证用户导航到 /pm2
- **THEN** 页面显示进程表格（名称、状态、CPU、内存、运行时间）

#### Scenario: 操作进程
- **WHEN** 用户点击进程的"重启"、"停止"或"重载"按钮
- **THEN** 系统执行对应操作并刷新状态

#### Scenario: 查看日志
- **WHEN** 用户点击进程的"日志"按钮
- **THEN** 页面打开日志面板显示最近日志

#### Scenario: 编辑配置
- **WHEN** 用户点击"编辑配置"
- **THEN** 页面显示 ecosystem.config.js 编辑器，保存后自动 reload
