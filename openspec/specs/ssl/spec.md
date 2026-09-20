## Purpose

在面板中提供 SSL 证书的申请与管理能力，基于 acme.sh 一键申请证书，并支持证书列表查看与自动配置到 Nginx。

## Requirements

### Requirement: acme.sh 安装检测

系统 SHALL 自动检测 acme.sh 是否已安装，并提供安装引导。

#### Scenario: 检测 acme.sh 已安装
- **WHEN** 已认证用户发送 GET /api/ssl/status
- **THEN** 系统返回 acme.sh 安装状态、版本号

#### Scenario: 安装 acme.sh
- **WHEN** 已认证用户发送 POST /api/ssl/install
- **THEN** 系统执行 acme.sh 安装脚本并返回安装结果

### Requirement: SSL 证书申请

系统 SHALL 支持通过 acme.sh 申请 Let's Encrypt SSL 证书。

#### Scenario: 成功申请证书
- **WHEN** 已认证用户发送 POST /api/ssl/issue，携带域名
- **THEN** 系统调用 acme.sh --issue，申请成功后将证书信息返回

#### Scenario: 申请证书失败
- **WHEN** acme.sh 申请证书失败
- **THEN** 系统返回 acme.sh 的错误输出信息

### Requirement: 证书列表查看

系统 SHALL 展示所有已申请的 SSL 证书。

#### Scenario: 获取证书列表
- **WHEN** 已认证用户发送 GET /api/ssl/certs
- **THEN** 系统从 ~/.acme.sh/ 目录解析并返回证书列表（域名、到期时间、签发日期）

### Requirement: 证书续期

系统 SHALL 支持手动续期 SSL 证书，续期后自动重载 Nginx。

#### Scenario: 成功续期证书
- **WHEN** 已认证用户发送 POST /api/ssl/renew/:domain
- **THEN** 系统执行 acme.sh --renew，成功后 reload nginx

### Requirement: 证书全部续期

系统 SHALL 支持一键续期所有已签发证书。

#### Scenario: 成功续期全部证书
- **WHEN** 已认证用户发送 POST /api/ssl/renew-all
- **THEN** 系统调用 acme.sh --renew-all，续期完成后 reload nginx，返回续期结果

### Requirement: 证书删除

系统 SHALL 支持从 acme.sh 中删除指定证书。

#### Scenario: 成功删除证书
- **WHEN** 已认证用户发送 DELETE /api/ssl/cert/:domain
- **THEN** 系统调用 acme.sh --remove -d <domain>，清理 ~/.acme.sh 中的对应目录，返回成功

#### Scenario: 删除不存在的证书
- **WHEN** 请求删除一个不存在的证书
- **THEN** 系统返回 404 错误

### Requirement: SSL 管理页面 UI

系统 SHALL 在 /#/ssl 提供 SSL 证书管理页面。

#### Scenario: 查看证书列表
- **WHEN** 已认证用户导航到 /ssl
- **THEN** 页面显示证书列表（域名、到期时间、签发日期）和 acme.sh 安装状态

#### Scenario: 申请证书
- **WHEN** 用户在证书页面输入域名并点击申请
- **THEN** 系统调用申请接口，显示申请进度和结果

#### Scenario: 手动续期
- **WHEN** 用户点击证书的续期按钮
- **THEN** 系统执行续期并显示结果

#### Scenario: 全部续期
- **WHEN** 用户点击"全部续期"按钮
- **THEN** 系统执行全部续期，显示进度和结果

#### Scenario: 删除证书
- **WHEN** 用户点击证书行的"删除"按钮并确认
- **THEN** 系统删除该证书，列表刷新
