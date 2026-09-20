## Purpose

在面板中提供 3X-UI 的运行状态查看与 Nginx 反代入口管理能力，支持检测 3X-UI 服务运行状态、配置反向代理入口，并提供对应的管理页面进行可视化操作。

## Requirements

### Requirement: 3X-UI 运行状态检测

系统 SHALL 自动检测 3X-UI 是否安装及运行状态。

#### Scenario: 检测 3X-UI 状态
- **WHEN** 已认证用户发送 GET /api/xui/status
- **THEN** 系统检测 systemctl status x-ui，返回安装状态、运行状态、端口、安装路径

#### Scenario: 3X-UI 未安装
- **WHEN** 系统检测到 3X-UI 未安装
- **THEN** 返回未安装状态，提示用户

### Requirement: 3X-UI Nginx 反代管理

系统 SHALL 为 3X-UI 配置 Nginx 反代入口。

#### Scenario: 配置反代入口
- **WHEN** 已认证用户发送 POST /api/xui/proxy，携带域名
- **THEN** 系统生成 Nginx 反代配置，将域名指向 3X-UI 管理端口

#### Scenario: 获取反代入口
- **WHEN** 已认证用户发送 GET /api/xui/proxy
- **THEN** 系统返回已配置的反代入口信息（URL）

#### Scenario: 移除反代入口
- **WHEN** 已认证用户发送 DELETE /api/xui/proxy
- **THEN** 系统删除对应的 Nginx 反代配置并 reload

### Requirement: 3X-UI 管理页面 UI

系统 SHALL 在 /#/xui 提供 3X-UI 管理页面。

#### Scenario: 查看 3X-UI 状态
- **WHEN** 已认证用户导航到 /xui
- **THEN** 页面显示状态卡片（安装状态、运行状态、管理端口、安装路径），不再显示版本号和详细信息卡片

#### Scenario: 配置反代
- **WHEN** 用户输入子域名并提交
- **THEN** 系统配置 Nginx 反代，页面显示入口链接

#### Scenario: 取消反代
- **WHEN** 用户点击取消反代按钮并确认
- **THEN** 系统移除反代配置
