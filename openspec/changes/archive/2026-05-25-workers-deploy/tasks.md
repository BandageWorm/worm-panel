# Workers Deploy — 实现任务

## Task 1: Workers 服务层 [x]

- [x] Workers 项目管理（CRUD 元数据存 config.json）
- [x] git clone/pull 操作封装
- [x] npx wrangler 命令执行
- [x] 部署日志捕获和存储

## Task 2: Workers API [x]

- [x] GET /api/workers/projects（项目列表）
- [x] POST /api/workers/projects（添加项目）
- [x] DELETE /api/workers/projects/:name（删除项目）
- [x] POST /api/workers/deploy/:name（触发部署）
- [x] GET /api/workers/deploy/:name/log（部署日志）
- [x] GET /api/workers/status（wrangler 检测）

## Task 3: 前端 Workers 管理页 [x]

- [x] 项目列表（名称、仓库、最近部署时间）
- [x] 添加项目表单（名称、仓库 URL、分支）
- [x] 部署按钮 + 部署日志实时展示
- [x] Wrangler 环境状态
