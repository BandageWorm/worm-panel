## Purpose

在面板中提供 3X-UI 的运行状态查看与 Nginx 反代入口管理能力。

## Requirements

### Requirement: 3X-UI 运行状态检测

系统应自动检测 3X-UI 是否安装及运行状态。

#### Scenario: 检测 3X-UI 状态
- **当** 已认证用户发送 GET /api/xui/status
- **则** 系统检测 systemctl status x-ui，返回安装状态、运行状态、端口、安装路径

#### Scenario: 3X-UI 未安装
- **当** 系统检测到 3X-UI 未安装
- **则** 返回未安装状态，提示用户

### Requirement: 3X-UI Nginx 反代管理

系统应为 3X-UI 配置 Nginx 反代入口。

#### Scenario: 配置反代入口
- **当** 已认证用户发送 POST /api/xui/proxy，携带域名
- **则** 系统生成 Nginx 反代配置，将域名指向 3X-UI 管理端口

#### Scenario: 获取反代入口
- **当** 已认证用户发送 GET /api/xui/proxy
- **则** 系统返回已配置的反代入口信息（URL）

#### Scenario: 移除反代入口
- **当** 已认证用户发送 DELETE /api/xui/proxy
- **则** 系统删除对应的 Nginx 反代配置并 reload

### Requirement: 3X-UI 管理页面 UI

系统应在 /#/xui 提供 3X-UI 管理页面。

#### Scenario: 查看 3X-UI 状态
- **当** 已认证用户导航到 /xui
- **则** 页面显示状态卡片（安装状态、运行状态、管理端口、安装路径），不再显示版本号和详细信息卡片

#### Scenario: 配置反代
- **当** 用户输入子域名并提交
- **则** 系统配置 Nginx 反代，页面显示入口链接

#### Scenario: 取消反代
- **当** 用户点击取消反代按钮并确认
- **则** 系统移除反代配置
