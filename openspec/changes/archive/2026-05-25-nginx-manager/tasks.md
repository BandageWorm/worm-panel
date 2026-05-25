# Nginx Manager — 实现任务

## Task 1: Nginx 服务层 [x]

- [x] 实现 nginx 配置读写（sites-enabled 目录）
- [x] 实现 nginx -t 校验执行
- [x] 实现 nginx -s reload 执行
- [x] 读取 nginx 运行状态（nginx -t 检测）
- [x] 配置备份功能（cp → data/backups/nginx/）

## Task 2: 反代站点 API [x]

- [x] GET /api/nginx/sites（扫描 sites-enabled 列出站点）
- [x] GET /api/nginx/sites/:name（读取单个配置）
- [x] POST /api/nginx/sites（用模板生成反代配置）
- [x] PUT /api/nginx/sites/:name（更新配置）
- [x] DELETE /api/nginx/sites/:name（删除站点）
- [x] POST /api/nginx/reload
- [x] POST /api/nginx/validate

## Task 3: 自我保护 [x]

- [x] 启动时根据 config.json 自动生成/更新 panel.conf
- [x] API 过滤 panel.conf 不可编辑/删除
- [x] 前端标记面板自身配置为只读

## Task 4: 前端 Nginx 管理页 [x]

- [x] 站点列表（名称、状态、域名）
- [x] 添加反代表单（域名、目标端口、备注）
- [x] 配置文本编辑器
- [x] 备份列表展示
- [x] 操作确认（尤其是删除和 reload）
