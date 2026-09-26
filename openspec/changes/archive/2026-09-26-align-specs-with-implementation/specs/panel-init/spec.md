# Spec Delta

## MODIFIED Requirements

### Requirement: 面板初始化

系统 SHALL 在首次启动时生成随机设置 Token，用户通过 /#/setup 完成初始化。

#### Scenario: 检查初始化状态

- **WHEN** 未认证用户发送 GET /api/setup/status
- **THEN** 系统返回是否已初始化

#### Scenario: 完成首次设置

- **WHEN** 用户发送 POST /api/setup，携带密码和可选域名/端口
- **THEN** 系统存储密码哈希，配置端口和模式（有域名时 proxy 模式，否则 standalone），返回成功

#### Scenario: 安装脚本

- **WHEN** Ubuntu/Debian 服务器运行 install.sh
- **THEN** 脚本 SHALL 通过 nvm 安装 Node.js 22.x 并软链到 /usr/bin/node、全局安装 pm2/wrangler/ws、安装 rclone 与 aliyundrive-webdav（含其 systemd service）、创建 /opt/worm-panel/ 并复制文件、执行 npm install、写入 worm-panel systemd unit、启动服务并打印设置 Token

### Requirement: 全局 UI 布局

系统 SHALL 使用宝塔面板风格的 UI 布局。

#### Scenario: 标准页面布局

- **WHEN** 已认证用户访问任何面板页面
- **THEN** 页面显示左侧深色导航栏（图标+文字菜单）、顶部状态栏（服务器名、CPU/内存/磁盘实时概况、时间）、主内容区（卡片式布局）

#### Scenario: 导航菜单

- **WHEN** 用户点击左侧导航菜单项
- **THEN** 页面路由到对应功能模块，菜单项 SHALL 与当前实际模块一致，顺序为：仪表盘、文件管理、文件直链、终端、防火墙、Nginx、SSL 证书、计划任务、记事本、PM2、Systemd、3X-UI、云备份、设置

#### Scenario: JWT 持久化

- **WHEN** 用户登录成功
- **THEN** JWT token 存储在 localStorage，后续请求自动附带
