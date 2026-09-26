## Purpose

在面板中提供基于阿里云盘（aliyundrive-webdav + rclone）的云备份能力，支持笔记同步、笔记恢复、备份历史查看以及备份盘（drive）的本地文件管理与同步。

## Requirements

### Requirement: 阿里云盘连接管理

系统应通过 aliyundrive-webdav 代理 + rclone webdav 后端连接阿里云盘。

#### Scenario: 获取安装指引
- **当** 已认证用户发送 POST /api/sync/auth-url
- **则** 系统返回 aliyundrive-webdav 安装和配置指引（含 QR 码登录说明）

#### Scenario: 完成 WebDAV 配置
- **当** 已认证用户提交 POST /api/sync/auth-complete，携带 url/user/password
- **则** 系统用 rclone obscure 加密密码
- **则** 系统测试 WebDAV 连通性（rclone lsf）
- **则** 测试通过后保存配置到 data/config.json
- **则** 系统返回连接成功状态

#### Scenario: 连接测试失败
- **当** WebDAV 连通性测试失败
- **则** 系统提示具体错误信息（连接超时/认证失败等）
- **则** 系统不保存配置

#### Scenario: 断开连接
- **当** 已认证用户发送 POST /api/sync/disconnect
- **则** 系统清除配置中的 WebDAV 配置和同步历史
- **则** 系统返回断开成功状态

#### Scenario: 查询连接状态
- **当** 已认证用户发送 GET /api/sync/status
- **则** 系统返回连接状态（已连接/未连接）、WebDAV 地址、WebDAV 账号、rclone 版本
- **则** 系统返回 aliyundrive-webdav 安装状态

### Requirement: 同步备份

系统应将 data/notes/ 目录内容同步到阿里云盘。

#### Scenario: 立即备份
- **当** 已认证用户发送 POST /api/sync/backup
- **则** 系统执行 rclone sync 将 data/notes/ 同步到云端
- **则** 系统记录本次备份结果（时间、状态、文件数、大小）

#### Scenario: 笔记保存触发备份
- **当** 用户保存笔记（PUT /api/notes/:name）
- **则** 系统保存笔记到本地
- **则** 系统异步触发后台备份，不阻塞 HTTP 响应

#### Scenario: 定时同步兜底
- **当** 系统设置的定时同步间隔到达（每 12 小时）
- **则** 系统自动执行 rclone sync

#### Scenario: 备份失败处理
- **当** rclone 同步过程中发生错误
- **则** 系统记录失败状态到历史记录
- **则** 系统不中断用户操作，错误仅在历史中展示

### Requirement: 从云端恢复

系统应支持从阿里云盘将备份数据恢复到本地。

#### Scenario: 恢复备份
- **当** 已认证用户发送 POST /api/sync/restore
- **则** 系统执行 rclone sync 从云端拉取数据到 data/notes/
- **则** 本地文件被云端版本覆盖

### Requirement: 备份历史记录

系统 SHALL 记录并展示备份操作的历史，历史记录保留上限为 20 条。

#### Scenario: 查询历史记录
- **当** 已认证用户发送 GET /api/sync/history
- **则** 系统返回备份历史列表（时间、状态、文件数、大小）

#### Scenario: 历史记录上限
- **WHEN** 备份历史记录超过 20 条
- **THEN** 系统自动删除最旧的记录，仅保留最近 20 条

### Requirement: 云备份页面 UI

系统应在 /#/sync 提供云备份管理页面。

#### Scenario: 未连接状态
- **当** 用户导航到 /sync
- **则** 页面显示阿里云盘连接引导：安装说明、WebDAV 配置表单

#### Scenario: 连接流程
- **当** 用户点击「连接阿里云盘」
- **则** 页面引导安装 aliyundrive-webdav、扫码登录、填入 WebDAV 连接信息

#### Scenario: 已连接状态
- **当** 用户已配置 WebDAV 连接
- **则** 页面显示连接服务商（按 WebDAV 地址识别，默认 aliyundrive-webdav 本地代理为阿里云盘）
- **则** 页面显示该连接对应的 WebDAV 账号
- **则** 页面显示连接状态、WebDAV 地址、最近同步时间
- **则** 页面提供「立即备份」「从云端恢复」「断开连接」按钮
- **则** 页面展示最近备份历史记录列表

#### Scenario: 备份进行中
- **当** 用户点击「立即备份」
- **则** 按钮显示加载状态，备份完成后更新状态和历史

#### Scenario: 恢复确认
- **当** 用户点击「从云端恢复」
- **则** 系统弹出确认对话框提示将覆盖本地文件
- **则** 用户确认后执行恢复操作

### Requirement: rclone 安装检测

系统应在配置页面检测 rclone 是否已安装，引导用户安装。

#### Scenario: rclone 未安装
- **当** 系统检测到 rclone 未安装
- **则** 页面提示「rclone 未安装」并显示安装指引
- **则** 连接相关操作不可用

### Requirement: aliyundrive-webdav 安装检测

系统应检测 aliyundrive-webdav 是否已安装。

#### Scenario: aliyundrive-webdav 未安装
- **当** 系统检测到 aliyundrive-webdav 未安装
- **则** 页面在连接引导中提示安装
- **则** 不影响已连接的备份功能
