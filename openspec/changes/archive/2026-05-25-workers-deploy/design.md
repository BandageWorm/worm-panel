# Workers Deploy — 设计文档

## 数据模型

```json
{
  "name": "my-api",
  "repo": "user/my-api",
  "branch": "main",
  "localPath": "/opt/worm-panel/workers/my-api/",
  "env": "production"
}
```

项目信息存储在 data/config.json 的 `workers` 字段中。

## API 设计

```
GET    /api/workers/projects           # 项目列表
POST   /api/workers/projects           # 添加项目 { name, repo, branch }
DELETE /api/workers/projects/:name     # 删除项目
POST   /api/workers/deploy/:name       # 触发部署
GET    /api/workers/deploy/:name/log   # 获取上次部署日志
GET    /api/workers/status             # wrangler 环境检测
```

## 部署流程

```
POST /api/workers/deploy/my-api
→ 1. cd /opt/worm-panel/workers/my-api/
→ 2. git pull origin main
→ 3. npx wrangler deploy 2>&1
→ 4. 捕获 stdout/stderr 作为日志返回
```

## 项目管理

- 添加项目时执行 `git clone {repo} {localPath}`
- 删除项目时选择是否保留本地文件
- 部署日志存储在 data/logs/workers/{name}.log
