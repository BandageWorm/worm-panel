## Purpose

在面板中提供 Nginx 的可视化管理能力，支持站点列表查看、反向代理站点的可视化增删、原生配置文本编辑，以及配置校验与重载，操作前自动备份且锁定面板自身反代配置。

## Requirements

### Requirement: Nginx 站点列表

系统 SHALL 扫描 Nginx sites-enabled 目录列出所有站点配置。

#### Scenario: 获取站点列表
- **WHEN** 已认证用户发送 GET /api/nginx/sites
- **THEN** 系统返回站点列表（名称、状态、域名），面板自身配置标记为只读

#### Scenario: 获取单个站点配置
- **WHEN** 已认证用户发送 GET /api/nginx/sites/:name
- **THEN** 系统返回该站点的完整配置内容

### Requirement: 反代站点管理

系统 SHALL 支持通过模板创建、更新、删除 Nginx 反代站点。

#### Scenario: 创建反代站点
- **WHEN** 已认证用户发送 POST /api/nginx/sites，携带域名、目标端口、备注
- **THEN** 系统生成 Nginx 反代配置，执行 nginx -t 校验后启用

#### Scenario: 更新站点配置
- **WHEN** 已认证用户发送 PUT /api/nginx/sites/:name，携带配置内容
- **THEN** 系统写入临时文件，nginx -t 校验成功后覆盖正式文件并 reload

#### Scenario: 更新失败回滚
- **WHEN** nginx -t 校验失败
- **THEN** 系统不覆盖正式文件，返回错误信息

#### Scenario: 删除站点
- **WHEN** 已认证用户发送 DELETE /api/nginx/sites/:name
- **THEN** 系统删除对应配置文件并 reload nginx

#### Scenario: 删除面板自身配置
- **WHEN** 用户尝试删除面板自身反代配置（panel.conf）
- **THEN** 系统拒绝操作，返回禁止删除错误

### Requirement: Nginx 操作

系统 SHALL 支持手动校验配置和重新加载 Nginx。

#### Scenario: 校验配置
- **WHEN** 已认证用户发送 POST /api/nginx/validate
- **THEN** 系统执行 nginx -t 并返回校验结果

#### Scenario: 重新加载
- **WHEN** 已认证用户发送 POST /api/nginx/reload
- **THEN** 系统执行 nginx -s reload 并返回结果

### Requirement: 配置备份

系统 SHALL 在修改 Nginx 配置前自动备份，保留最近 30 份。

#### Scenario: 自动备份
- **WHEN** 系统即将修改 Nginx 配置文件
- **THEN** 系统先将当前配置备份到 data/backups/nginx/，文件名包含时间戳

#### Scenario: 查看备份列表
- **WHEN** 已认证用户发送 GET /api/nginx/backups
- **THEN** 系统返回备份列表（文件名、时间）

### Requirement: Nginx 管理页面 UI

系统 SHALL 在 /#/nginx 提供 Nginx 管理页面。

#### Scenario: 查看站点列表
- **WHEN** 已认证用户导航到 /nginx
- **THEN** 页面显示站点列表（名称、状态、域名），面板配置标记为只读

#### Scenario: 添加反代站点
- **WHEN** 用户填写域名、目标端口、备注并提交
- **THEN** 系统创建反代配置

#### Scenario: 编辑配置
- **WHEN** 用户点击编辑站点
- **THEN** 页面显示配置文本编辑器，支持语法高亮

#### Scenario: 删除站点
- **WHEN** 用户点击删除并确认
- **THEN** 系统删除站点配置
