## Purpose

在面板中提供系统设置能力，支持查看与更新域名、端口等面板配置，修改管理员密码，重启面板服务，并提供对应的设置页面表单进行可视化操作。

## Requirements

### Requirement: 查看面板设置

系统 SHALL 提供只读 API 端点返回当前面板设置。

#### Scenario: 成功获取设置
- **WHEN** 已认证用户发送 GET /api/settings
- **THEN** 系统返回 port、mode、domain（仅非敏感字段）

### Requirement: 更新面板设置

系统 SHALL 允许已认证用户通过 PUT /api/settings 更新面板设置。

#### Scenario: 成功更新端口
- **WHEN** 已认证用户发送 PUT /api/settings，携带合法端口号（1024-65535）
- **THEN** 系统更新 config.json 中的端口并返回成功

#### Scenario: 从 standalone 切换到 proxy
- **WHEN** 已认证用户发送 PUT /api/settings，mode 为 "proxy" 且携带合法域名
- **THEN** 系统更新 config.json 中的 mode 和 domain，生成 nginx 面板配置，返回成功

#### Scenario: 从 proxy 切换到 standalone
- **WHEN** 已认证用户发送 PUT /api/settings，mode 为 "standalone"
- **THEN** 系统更新 config.json 中的 mode 并返回成功

#### Scenario: 切换到 proxy 但未提供域名
- **WHEN** 已认证用户发送 PUT /api/settings，mode 为 "proxy" 但未提供 domain
- **THEN** 系统返回校验错误

#### Scenario: 使用非法端口
- **WHEN** 已认证用户发送 PUT /api/settings，port 不在 1024-65535 范围内
- **THEN** 系统返回校验错误

### Requirement: 修改管理员密码

系统 SHALL 允许已认证用户修改管理员密码。

#### Scenario: 成功修改密码
- **WHEN** 已认证用户发送 PUT /api/settings，携带 password 字段（6位以上）
- **THEN** 系统用 bcrypt 哈希新密码，更新 config.json，返回成功

#### Scenario: 密码太短
- **WHEN** 已认证用户发送 PUT /api/settings，password 不足 6 位
- **THEN** 系统返回校验错误

### Requirement: 重启面板服务

系统 SHALL 提供 API 端点用于重启面板服务。

#### Scenario: 重启面板
- **WHEN** 已认证用户发送 POST /api/settings/restart
- **THEN** 系统返回成功并启动进程重启

### Requirement: 设置页面 UI

系统 SHALL 在 /#/settings 提供设置页面，包含管理面板配置的表单。

#### Scenario: 显示当前设置
- **WHEN** 已认证用户导航到 /settings
- **THEN** 页面加载并显示当前 port、mode、domain 值

#### Scenario: 编辑端口
- **WHEN** 用户修改端口号并点击保存
- **THEN** 系统发送 PUT /api/settings 携带新端口，显示成功消息

#### Scenario: 切换到 proxy 模式
- **WHEN** 用户选择 "proxy" 模式、输入域名并点击保存
- **THEN** 系统发送 PUT /api/settings 携带 mode "proxy" 和域名，显示成功消息

#### Scenario: 切换到 standalone 模式
- **WHEN** 用户选择 "standalone" 模式并点击保存
- **THEN** 系统发送 PUT /api/settings 携带 mode "standalone"，显示重启提示

#### Scenario: 修改密码
- **WHEN** 用户输入新密码和确认密码（一致且6位以上）并点击保存
- **THEN** 系统发送 PUT /api/settings 携带新密码，显示成功消息

#### Scenario: 密码不一致校验
- **WHEN** 用户输入不一致的密码和确认密码
- **THEN** 界面显示校验错误，不发送 API 请求

#### Scenario: 从 UI 重启面板
- **WHEN** 用户点击"重启面板"按钮并确认
- **THEN** 系统发送 POST /api/settings/restart，显示倒计时消息提示用户刷新
