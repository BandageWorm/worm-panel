# Nginx Manager — 设计文档

## API 设计

```
GET    /api/nginx/sites          # 列出所有 site
GET    /api/nginx/sites/:name    # 获取单个 site 配置
POST   /api/nginx/sites          # 创建反代站点
PUT    /api/nginx/sites/:name    # 更新站点配置
DELETE /api/nginx/sites/:name    # 删除站点
POST   /api/nginx/reload         # 重新加载 nginx
GET    /api/nginx/status         # nginx 运行状态
GET    /api/nginx/backups        # 备份列表
POST   /api/nginx/validate       # 校验配置
```

## 反代配置模板

```nginx
server {
    listen 80;
    server_name {{domain}};

    location / {
        proxy_pass http://127.0.0.1:{{target_port}};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 自我保护

- 面板自身配置存为 `/etc/nginx/sites-enabled/panel.conf`
- 该文件由面板启动时自动写入，内容根据 config.json 生成
- API 层过滤：DELETE/PUT 操作跳过 panel.conf
- 配置列表标记面板自身配置为只读

## 备份策略

- 每次修改前 cp 一份到 data/backups/nginx/
- 备份文件名: `{site-name}.{YYYYMMDDHHmmss}.conf.bak`
- 保留最近 30 份备份

## 配置编辑器

- 读取 sites-enabled 下 .conf 文件内容
- 前端使用 CodeMirror 或 Monaco 编辑器（nginx 语法模式）
- 保存流程: 写入临时文件 → nginx -t → 成功则覆盖正式文件 → reload
- 如果 nginx -t 失败，返回错误信息，不覆盖
