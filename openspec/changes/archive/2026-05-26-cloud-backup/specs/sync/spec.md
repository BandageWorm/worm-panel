## ADDED Requirements

### Requirement: 阿里云盘连接管理

系统应通过 aliyundrive-webdav 代理 + rclone webdav 后端连接阿里云盘。

#### Scenario: 获取安装指引
- **WHEN** 已认证用户发送 POST /api/sync/auth-url
- **THEN** 系统返回 aliyundrive-webdav 安装和配置指引（含 QR 码登录说明）

#### Scenario: 完成 WebDAV 配置
- **WHEN** 已认证用户提交 POST /api/sync/auth-complete，携带 url/user/password
- **THEN** 系统用 rclone obscure 加密密码
- **THEN** 系统测试 WebDAV 连通性（rclone lsf）
- **THEN** 测试通过后保存配置到 data/config.json
- **THEN** 系统返回连接成功状态

#### Scenario: 连接测试失败
- **WHEN** WebDAV 连通性测试失败
- **THEN** 系统提示具体错误信息（连接超时/认证失败等）
- **THEN** 系统不保存配置

#### Scenario: 断开连接
- **WHEN** 已认证用户发送 POST /api/sync/disconnect
- **THEN** 系统清除配置中的 refresh_token 和同步历史
- **THEN** 系统返回断开成功状态

#### Scenario: 查询连接状态
- **WHEN** 已认证用户发送 GET /api/sync/status
- **THEN** 系统返回连接状态（已连接/未连接）、WebDAV 地址、rclone 版本
- **THEN** 系统返回 aliyundrive-webdav 安装状态

### Requirement: 同步备份

系统应将 data/notes/ 目录内容同步到阿里云盘指定路径。

#### Scenario: 立即备份
- **WHEN** 已认证用户发送 POST /api/sync/backup
- **THEN** 系统执行 rclone sync 将 data/notes/ 同步到云端
- **THEN** 系统记录本次备份结果（时间、状态、文件数、大小）

#### Scenario: 笔记保存触发备份
- **WHEN** 用户保存笔记（PUT /api/notes/:name）
- **THEN** 系统保存笔记到本地
- **THEN** 系统异步触发后台备份，不阻塞 HTTP 响应

#### Scenario: 定时同步兜底
- **WHEN** 系统设置的定时同步间隔到达（每 12 小时）
- **THEN** 系统自动执行 rclone sync

#### Scenario: 备份失败处理
- **WHEN** rclone 同步过程中发生错误
- **THEN** 系统记录失败状态到历史记录
- **THEN** 系统不中断用户操作，错误仅在历史中展示

### Requirement: 从云端恢复

系统应支持从阿里云盘将备份数据恢复到本地。

#### Scenario: 恢复备份
- **WHEN** 已认证用户发送 POST /api/sync/restore
- **THEN** 系统执行 rclone sync 从云端拉取数据到 data/notes/
- **THEN** 本地文件被云端版本覆盖

### Requirement: 备份历史记录

系统应记录并展示备份操作的历史。

#### Scenario: 查询历史记录
- **WHEN** 已认证用户发送 GET /api/sync/history
- **THEN** 系统返回备份历史列表（时间、状态、文件数、大小）

#### Scenario: 历史记录上限
- **WHEN** 备份历史记录超过 50 条
- **THEN** 系统自动删除最旧的记录

### Requirement: 云备份页面 UI

系统应在 /#/sync 提供云备份管理页面。

#### Scenario: 未连接状态
- **WHEN** 用户导航到 /sync
- **THEN** 页面显示阿里云盘连接引导：授权按钮、说明文案

#### Scenario: 连接流程
- **WHEN** 用户点击「连接阿里云盘」
- **THEN** 系统获取授权 URL 并展示为链接和二维码
- **THEN** 用户授权后输入 code 完成绑定

#### Scenario: 已连接状态
- **WHEN** 用户已连接阿里云盘
- **THEN** 页面显示连接状态、已用容量、最近同步时间
- **THEN** 页面提供「立即备份」「从云端恢复」「断开连接」按钮
- **THEN** 页面展示最近备份历史记录列表

#### Scenario: 备份进行中
- **WHEN** 用户点击「立即备份」
- **THEN** 按钮显示加载状态，备份完成后更新状态和历史

#### Scenario: 恢复确认
- **WHEN** 用户点击「从云端恢复」
- **THEN** 系统弹出确认对话框提示将覆盖本地文件
- **THEN** 用户确认后执行恢复操作

### Requirement: rclone 安装检测

系统应在配置页面检测 rclone 是否已安装，引导用户安装。

#### Scenario: rclone 未安装
- **WHEN** 系统检测到 rclone 未安装
- **THEN** 页面提示「rclone 未安装」并显示安装指引
- **THEN** 连接相关操作不可用

### Requirement: aliyundrive-webdav 安装检测

系统应检测 aliyundrive-webdav 是否已安装。

#### Scenario: aliyundrive-webdav 未安装
- **WHEN** 系统检测到 aliyundrive-webdav 未安装
- **THEN** 页面在连接引导中提示安装
- **THEN** 不影响已连接的备份功能
