# PM2 Manager — 设计文档

## PM2 API 集成

使用 `pm2` npm 包直接连接 PM2 守护进程：

```javascript
const pm2 = require('pm2');

pm2.connect((err) => {
  pm2.list((err, list) => {
    // list → 进程列表
  });
});
```

## API 设计

```
GET    /api/pm2/processes          # 进程列表
POST   /api/pm2/restart/:name      # 重启进程
POST   /api/pm2/stop/:name         # 停止进程
POST   /api/pm2/reload/:name       # 重载进程
GET    /api/pm2/logs/:name         # 获取日志（最近 N 行）
GET   /api/pm2/config              # 读取 ecosystem.config.js
PUT   /api/pm2/config              # 写入 ecosystem.config.js
```

## 进程列表数据

```json
[
  {
    "name": "my-app",
    "pid": 12345,
    "status": "online",
    "cpu": 0.5,
    "memory": 52428800,
    "uptime": 3600,
    "restarts": 2,
    "pm2_env": {
      "exec_mode": "fork",
      "watch": true
    }
  }
]
```

## 日志查看

- 使用 `pm2.js` 内置日志或直接读取日志文件
- 默认返回最后 200 行
- 支持前端实时刷新（可选 polling）

## 配置编辑

- ecosystem.config.js 存储在 /opt/worm-panel/ 或项目目录
- 前端以文本编辑器形式展示
- 保存后自动 reload PM2
