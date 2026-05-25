# SSL Cert — 设计文档

## acme.sh 集成

```javascript
// services/acme.js
class AcmeService {
  async checkInstalled()    // 检测 acme.sh 是否安装
  async install()           // 安装 acme.sh
  async issueCert(domain)   // 申请证书 --issue --nginx
  async renewCert(domain)   // 续期 --renew
  async listCerts()         // 列出已注册证书 --list
  async getCertInfo(domain) // 获取证书详情
}
```

## API 设计

```
GET    /api/ssl/status              # acme.sh 安装状态
POST   /api/ssl/install             # 安装 acme.sh
GET    /api/ssl/certs               # 证书列表
POST   /api/ssl/issue               # 申请证书 { domain: "example.com" }
POST   /api/ssl/renew/:domain       # 续期指定证书
POST   /api/ssl/apply-to-nginx      # 将证书应用到 nginx { domain, site_name }
```

## 申请流程

```
1. 用户输入域名
2. 后端检查 80 端口是否可达（acme.sh http-01 需要）
3. 执行 acme.sh --issue -d {domain} --nginx
4. 如果成功:
   - 解析证书路径 ~/.acme.sh/{domain}/fullchain.cer
   - 更新对应 nginx server block 配置（添加 SSL）
5. 如果失败:
   - 返回 acme.sh 错误输出
```

## Nginx SSL 配置模板

```nginx
server {
    listen 443 ssl;
    server_name {{domain}};

    ssl_certificate     /root/.acme.sh/{{domain}}/fullchain.cer;
    ssl_certificate_key /root/.acme.sh/{{domain}}/{{domain}}.key;

    location / {
        proxy_pass http://127.0.0.1:{{target_port}};
        ...
    }
}

server {
    listen 80;
    server_name {{domain}};
    return 301 https://$host$request_uri;
}
```

## 续期

- acme.sh 自带 cron 每日自动检查续期
- 面板额外提供手动续期按钮
- 续期后自动 reload nginx
