# SSL Cert — 实现任务

## Task 1: acme.sh 服务层 [x]

- [x] 实现 AcmeService 类
- [x] 检测 acme.sh 是否已安装
- [x] 调用 acme.sh 命令执行申请/续期/列表
- [x] 解析 acme.sh 输出结果

## Task 2: SSL 证书 API [x]

- [x] GET /api/ssl/certs（证书列表，从 ~/.acme.sh/ 目录解析）
- [x] POST /api/ssl/issue（申请证书 { domain }）
- [x] POST /api/ssl/renew/:domain（续期）
- [x] POST /api/ssl/apply-to-nginx（证书关联到 Nginx 配置）

## Task 3: 证书-nginx 联动 [x]

- [x] 申请成功后可通过 apply-to-nginx 配置 Nginx
- [x] 生成 SSL 配置模板（443 + 80 重定向）
- [x] nginx -t 校验 → reload
- [x] 续期后自动 reload nginx

## Task 4: 前端 SSL 管理页 [x]

- [x] acme.sh 安装状态展示（未安装时引导安装）
- [x] 证书列表（域名、到期时间、签发日期）
- [x] 一键申请表单（输入域名 → 申请）
- [x] 手动续期按钮
- [x] 配置 Nginx SSL 功能
