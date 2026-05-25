# XUI Integration — 设计文档

## 3X-UI 发现

自动检测 3X-UI 安装路径，检查顺序：

1. `systemctl status x-ui` → 获取运行状态
2. 检测常见路径：`/opt/3x-ui/`、`/usr/local/x-ui/`
3. 读取 3X-UI 配置文件获取管理端口
4. 如果未安装，提示用户

## API 设计

```
GET /api/xui/status          # 3X-UI 运行状态
GET /api/xui/info            # 详细信息（端口、版本、运行时间）
POST /api/xui/proxy          # 配置 Nginx 反代 { domain }
DELETE /api/xui/proxy        # 移除 Nginx 反代
GET /api/xui/proxy           # 获取反代入口信息
```

## 状态展示

```json
{
  "installed": true,
  "running": true,
  "version": "2.4.0",
  "port": 2053,
  "memory": 25600,
  "cpu": 0.2,
  "uptime": 86400,
  "installPath": "/opt/3x-ui/",
  "proxyUrl": null
}
```

## 反代入口

- 用户在面板配置子域名 → 生成 nginx server block
- 反代到 `http://127.0.0.1:{xui_port}`
- 可选：自动申请 SSL 证书
- 面板生成入口链接，点击可直接打开 3X-UI 管理界面
