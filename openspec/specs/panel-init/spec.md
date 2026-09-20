## Purpose

提供面板运行的基础能力，包括首次启动时的初始化流程、基于 bcrypt 与 JWT 的用户认证、系统配置文件管理，以及展示系统概览和快捷入口的仪表盘。

## Requirements

### Requirement: 面板初始化

系统 SHALL 在首次启动时生成随机设置 Token，用户通过 /#/setup 完成初始化。

#### Scenario: 检查初始化状态
- **WHEN** 未认证用户发送 GET /api/setup/status
- **THEN** 系统返回是否已初始化

#### Scenario: 完成首次设置
- **WHEN** 用户发送 POST /api/setup，携带密码和可选域名/端口
- **THEN** 系统存储密码哈希，配置端口和模式（有域名时 proxy 模式，否则 standalone），返回成功

#### Scenario: 安装脚本
- **WHEN** Ubuntu 服务器运行 install.sh
- **THEN** 安装 Node.js、创建 /opt/worm-panel/、复制文件、npm install、写入 systemd unit、启动服务、打印设置 Token

### Requirement: 用户认证

系统 SHALL 使用 bcrypt + JWT 进行认证，JWT 有效期 48 小时。

#### Scenario: 登录成功
- **WHEN** 用户发送 POST /api/auth/login，携带正确密码
- **THEN** 系统验证 bcrypt 哈希，返回 JWT token（48h 过期）

#### Scenario: 登录失败
- **WHEN** 用户发送 POST /api/auth/login，携带错误密码
- **THEN** 系统返回认证错误

#### Scenario: 访问受保护 API
- **WHEN** 请求携带有效 JWT Bearer token
- **THEN** 系统验证 token 通过，允许访问

#### Scenario: 访问受保护 API（无 token）
- **WHEN** 请求未携带 JWT token
- **THEN** 系统返回 401 未授权

### Requirement: 仪表盘

系统 SHALL 在 /#/ 提供仪表盘，展示系统概览和快捷入口。

#### Scenario: 获取仪表盘数据
- **WHEN** 已认证用户发送 GET /api/dashboard
- **THEN** 系统返回系统信息（OS、内核、运行时间）、资源使用率（CPU、内存、磁盘）、网络流量、面板信息

#### Scenario: 查看仪表盘页面
- **WHEN** 已认证用户导航到 /
- **THEN** 页面显示服务器概况卡片、资源使用率（CPU 环形进度、内存进度条、磁盘进度条）、网络流量、各模块快捷入口

### Requirement: 全局 UI 布局

系统 SHALL 使用宝塔面板风格的 UI 布局。

#### Scenario: 标准页面布局
- **WHEN** 已认证用户访问任何面板页面
- **THEN** 页面显示左侧深色导航栏（图标+文字菜单）、顶部状态栏（服务器名、CPU/内存/磁盘实时概况、时间）、主内容区（卡片式布局）

#### Scenario: 导航菜单
- **WHEN** 用户点击左侧导航菜单项
- **THEN** 页面路由到对应功能模块（仪表盘、Nginx、SSL、记事本、PM2、Workers、3X-UI、设置）

#### Scenario: JWT 持久化
- **WHEN** 用户登录成功
- **THEN** JWT token 存储在 localStorage，后续请求自动附带

### Requirement: systemd 服务

系统 SHALL 通过 systemd 管理，支持开机自启和崩溃自动重启。

#### Scenario: 服务管理
- **WHEN** 服务器重启
- **THEN** systemd 自动启动 worm-panel 服务

#### Scenario: 崩溃恢复
- **WHEN** 面板进程异常退出
- **THEN** systemd 自动重启服务（Restart=always）

### Requirement: 配置管理

系统 SHALL 将配置文件存储在 data/config.json，支持双模式运行。

#### Scenario: Standalone 模式
- **WHEN** 配置 mode 为 standalone
- **THEN** 面板监听 0.0.0.0:4567，HTTP 直连

#### Scenario: Proxy 模式
- **WHEN** 配置 mode 为 proxy 且配置了域名
- **THEN** 面板监听 127.0.0.1:4567，自动生成 Nginx 反代配置
