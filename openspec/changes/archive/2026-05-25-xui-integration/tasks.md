# XUI Integration — 实现任务

## Task 1: 3X-UI 检测服务 [x]

- [x] 检测 3X-UI 是否安装（systemctl status x-ui）
- [x] 检测安装路径（/opt/3x-ui/、/usr/local/x-ui/）
- [x] 获取 3X-UI 管理端口
- [x] 解析 3X-UI 运行状态

## Task 2: 3X-UI API [x]

- [x] GET /api/xui/status（运行状态）
- [x] GET /api/xui/info（详细信息）
- [x] POST /api/xui/proxy（配置 Nginx 反代）
- [x] DELETE /api/xui/proxy（移除反代）
- [x] GET /api/xui/proxy（获取入口信息）

## Task 3: 前端 3X-UI 页面 [x]

- [x] 运行状态卡片（安装/运行、版本、端口）
- [x] 详细信息展示（路径、CPU、内存、运行时间）
- [x] 配置反代入口表单（子域名输入）
- [x] 入口链接展示（点击直达）
- [x] 取消反代按钮
