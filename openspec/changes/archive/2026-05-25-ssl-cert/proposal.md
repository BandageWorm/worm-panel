# SSL Cert — SSL 证书一键申请

## 目标

集成 acme.sh，支持在面板中一键申请和续期 SSL 证书，并自动关联到 Nginx 配置。

## 范围

- 集成 acme.sh 命令行工具（自动安装检测）
- 一键申请证书（域名输入 → acme.sh --issue → Nginx 配置）
- 证书列表展示（域名、到期时间、签发机构）
- 手动续期操作
- 证书自动关联到对应 Nginx server block（配置 SSL）
- 查询 acme.sh 已注册证书

## 非目标

- 不处理泛域名证书（*.example.com）的 DNS API 配置
- 不处理非 acme.sh 来源的证书导入
- 不处理证书吊销
