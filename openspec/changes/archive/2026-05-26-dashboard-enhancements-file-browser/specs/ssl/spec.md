## ADDED Requirements

### Requirement：证书全部续期

系统应支持一键续期所有已签发证书。

#### Scenario：成功续期全部证书
- **WHEN** 已认证用户发送 POST /api/ssl/renew-all
- **THEN** 系统调用 acme.sh --renew-all，续期完成后 reload nginx，返回续期结果

### Requirement：证书删除

系统应支持从 acme.sh 中删除指定证书。

#### Scenario：成功删除证书
- **WHEN** 已认证用户发送 DELETE /api/ssl/cert/:domain
- **THEN** 系统调用 acme.sh --remove -d <domain>，清理 ~/.acme.sh 中的对应目录，返回成功

#### Scenario：删除不存在的证书
- **WHEN** 请求删除一个不存在的证书
- **THEN** 系统返回 404 错误

### Requirement：SSL 管理页面 UI 调整

SSL 管理页面应调整操作按钮布局。

#### Scenario：全部续期
- **WHEN** 用户在 SSL 管理页面点击"全部续期"按钮
- **THEN** 系统执行全部续期，显示进度和结果

#### Scenario：删除证书
- **WHEN** 用户点击证书行的"删除"按钮并确认
- **THEN** 系统删除该证书，列表刷新

#### Scenario：不再显示配置 Nginx
- **WHEN** 用户查看证书列表
- **THEN** 每行不再显示"配置 Nginx"按钮

## MODIFIED Requirements

### Requirement：证书续期

#### Scenario：成功续期证书
- **WHEN** 已认证用户发送 POST /api/ssl/renew/:domain
- **THEN** 系统执行 acme.sh --renew，成功后 reload nginx

### Requirement：证书列表查看

#### Scenario：获取证书列表
- **WHEN** 已认证用户发送 GET /api/ssl/certs
- **THEN** 系统从 ~/.acme.sh/ 目录解析并返回证书列表（域名、到期时间、签发日期）

## REMOVED Requirements

### Requirement：证书应用到 Nginx

**Reason**: 从 UI 中去掉"配置 Nginx"按钮，简化 SSL 管理流程。用户应通过 Nginx 管理页面自行配置 SSL 站点。后端 API 保留不删除，以免影响已有脚本。

**Migration**: 如有需要，可通过 Nginx 管理模块手动配置 SSL 证书的站点。
