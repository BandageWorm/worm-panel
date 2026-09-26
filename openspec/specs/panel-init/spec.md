## Purpose

定义面板的初始化与基础运行能力：首次启动的设置 Token 与初始化流程、bcrypt + JWT 认证、仪表盘、全局 UI 布局、systemd 服务托管以及双模式配置管理。

## Requirements

### Requirement: 面板初始化

系统 SHALL 在首次启动时生成随机设置 Token，用户通过 /#/setup 完成初始化。

#### Scenario: 检查初始化状态
- **当** 未认证用户发送 GET /api/setup/status
- **则** 系统返回是否已初始化

#### Scenario: 完成首次设置
- **当** 用户发送 POST /api/setup，携带密码和可选域名/端口
- **则** 系统存储密码哈希，配置端口和模式（有域名时 proxy 模式，否则 standalone），返回成功

#### Scenario: 安装脚本
- **WHEN** Ubuntu/Debian 服务器运行 install.sh
- **THEN** 脚本 SHALL 通过 nvm 安装 Node.js 22.x 并软链到 /usr/bin/node、全局安装 pm2/wrangler/ws、安装 rclone 与 aliyundrive-webdav（含其 systemd service）、创建 /opt/worm-panel/ 并复制文件、执行 npm install、写入 worm-panel systemd unit、启动服务并打印设置 Token

### Requirement: 用户认证

系统应使用 bcrypt + JWT 进行认证，JWT 有效期 48 小时。

#### Scenario: 登录成功
- **当** 用户发送 POST /api/auth/login，携带正确密码
- **则** 系统验证 bcrypt 哈希，返回 JWT token（48h 过期）

#### Scenario: 登录失败
- **当** 用户发送 POST /api/auth/login，携带错误密码
- **则** 系统返回认证错误

#### Scenario: 访问受保护 API
- **当** 请求携带有效 JWT Bearer token
- **则** 系统验证 token 通过，允许访问

#### Scenario: 访问受保护 API（无 token）
- **当** 请求未携带 JWT token
- **则** 系统返回 401 未授权

### Requirement: 仪表盘

系统应在 /#/ 提供仪表盘，展示系统概览和快捷入口。

#### Scenario: 获取仪表盘数据
- **当** 已认证用户发送 GET /api/dashboard
- **则** 系统返回系统信息（OS、内核、运行时间）、资源使用率（CPU、内存、磁盘）、网络流量、面板信息

#### Scenario: 查看仪表盘页面
- **当** 已认证用户导航到 /
- **则** 页面显示服务器概况卡片、资源使用率（CPU 环形进度、内存进度条、磁盘进度条）、网络流量、各模块快捷入口

### Requirement: 全局 UI 布局

系统 SHALL 使用宝塔面板风格的 UI 布局。

#### Scenario: 标准页面布局
- **当** 已认证用户访问任何面板页面
- **则** 页面显示左侧深色导航栏（图标+文字菜单）、顶部状态栏（服务器名、CPU/内存/磁盘实时概况、时间）、主内容区（卡片式布局）

#### Scenario: 导航菜单
- **WHEN** 用户点击左侧导航菜单项
- **THEN** 页面路由到对应功能模块，菜单项 SHALL 与当前实际模块一致，顺序为：仪表盘、文件管理、文件直链、终端、防火墙、Nginx、SSL 证书、计划任务、记事本、PM2、Systemd、3X-UI、云备份、设置

#### Scenario: JWT 持久化
- **当** 用户登录成功
- **则** JWT token 存储在 localStorage，后续请求自动附带

### Requirement: systemd 服务

系统应通过 systemd 管理，支持开机自启和崩溃自动重启。

#### Scenario: 服务管理
- **当** 服务器重启
- **则** systemd 自动启动 worm-panel 服务

#### Scenario: 崩溃恢复
- **当** 面板进程异常退出
- **则** systemd 自动重启服务（Restart=always）

### Requirement: 配置管理

系统配置文件存储在 data/config.json，支持双模式运行。

#### Scenario: Standalone 模式
- **当** 配置 mode 为 standalone
- **则** 面板监听 0.0.0.0:4567，HTTP 直连

#### Scenario: Proxy 模式
- **当** 配置 mode 为 proxy 且配置了域名
- **则** 面板监听 127.0.0.1:4567，自动生成 Nginx 反代配置
