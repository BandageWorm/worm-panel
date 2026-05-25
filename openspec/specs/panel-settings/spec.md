## 新增需求

### 需求：查看面板设置

系统应提供只读 API 端点返回当前面板设置。

#### 场景：成功获取设置
- **当** 已认证用户发送 GET /api/settings
- **则** 系统返回 port、mode、domain（仅非敏感字段）

### 需求：更新面板设置

系统应允许已认证用户通过 PUT /api/settings 更新面板设置。

#### 场景：成功更新端口
- **当** 已认证用户发送 PUT /api/settings，携带合法端口号（1024-65535）
- **则** 系统更新 config.json 中的端口并返回成功

#### 场景：从 standalone 切换到 proxy
- **当** 已认证用户发送 PUT /api/settings，mode 为 "proxy" 且携带合法域名
- **则** 系统更新 config.json 中的 mode 和 domain，生成 nginx 面板配置，返回成功

#### 场景：从 proxy 切换到 standalone
- **当** 已认证用户发送 PUT /api/settings，mode 为 "standalone"
- **则** 系统更新 config.json 中的 mode 并返回成功

#### 场景：切换到 proxy 但未提供域名
- **当** 已认证用户发送 PUT /api/settings，mode 为 "proxy" 但未提供 domain
- **则** 系统返回校验错误

#### 场景：使用非法端口
- **当** 已认证用户发送 PUT /api/settings，port 不在 1024-65535 范围内
- **则** 系统返回校验错误

### 需求：修改管理员密码

系统应允许已认证用户修改管理员密码。

#### 场景：成功修改密码
- **当** 已认证用户发送 PUT /api/settings，携带 password 字段（6位以上）
- **则** 系统用 bcrypt 哈希新密码，更新 config.json，返回成功

#### 场景：密码太短
- **当** 已认证用户发送 PUT /api/settings，password 不足 6 位
- **则** 系统返回校验错误

### 需求：重启面板服务

系统应提供 API 端点用于重启面板服务。

#### 场景：重启面板
- **当** 已认证用户发送 POST /api/settings/restart
- **则** 系统返回成功并启动进程重启

### 需求：设置页面 UI

系统应在 /#/settings 提供设置页面，包含管理面板配置的表单。

#### 场景：显示当前设置
- **当** 已认证用户导航到 /settings
- **则** 页面加载并显示当前 port、mode、domain 值

#### 场景：编辑端口
- **当** 用户修改端口号并点击保存
- **则** 系统发送 PUT /api/settings 携带新端口，显示成功消息

#### 场景：切换到 proxy 模式
- **当** 用户选择 "proxy" 模式、输入域名并点击保存
- **则** 系统发送 PUT /api/settings 携带 mode "proxy" 和域名，显示成功消息

#### 场景：切换到 standalone 模式
- **当** 用户选择 "standalone" 模式并点击保存
- **则** 系统发送 PUT /api/settings 携带 mode "standalone"，显示重启提示

#### 场景：修改密码
- **当** 用户输入新密码和确认密码（一致且6位以上）并点击保存
- **则** 系统发送 PUT /api/settings 携带新密码，显示成功消息

#### 场景：密码不一致校验
- **当** 用户输入不一致的密码和确认密码
- **则** 界面显示校验错误，不发送 API 请求

#### 场景：从 UI 重启面板
- **当** 用户点击"重启面板"按钮并确认
- **则** 系统发送 POST /api/settings/restart，显示倒计时消息提示用户刷新
