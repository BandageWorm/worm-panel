# Init Panel — 实现任务

## Task 1: 项目初始化 [x]

- [x] 初始化 package.json
- [x] 安装后端依赖：express、bcryptjs、jsonwebtoken、cors、systeminformation
- [x] 安装前端 Vue 3 + Vite + Element Plus + Vue Router
- [x] 配置 .gitignore

## Task 2: 配置文件管理 [x]

- [x] 实现 data/config.json 的读写逻辑
- [x] 默认配置：port=4567, mode=standalone, initialized=false
- [x] 启动时确保 data/notes/、data/backups/、data/logs/ 目录存在

## Task 3: 认证系统 [x]

- [x] 实现 crypto.js（bcrypt 哈希 + JWT sign/verify）
- [x] 实现 JWT 验证中间件
- [x] 登录路由 POST /api/auth/login
- [x] JWT 48h 过期

## Task 4: 首次设置流程 [x]

- [x] 启动时生成随机 setupToken，输出到日志
- [x] 设置页面 GET /api/setup/status（检查是否已初始化）
- [x] 设置路由 POST /api/setup（设置密码 + 可选域名/端口）
- [x] 切换到 proxy 模式（如有域名）或 standalone 模式

## Task 5: 前端 UI 框架（宝塔风格）[x]

- [x] 全局布局：左侧深色导航栏 + 顶部状态栏 + 主内容区
- [x] 左侧菜单：仪表盘、Nginx、SSL、记事本、PM2、Workers、3X-UI、设置
- [x] 顶部状态栏：服务器名、CPU/内存/磁盘实时概况、时间
- [x] 路由结构：/ → 仪表盘，/nginx → Nginx 管理，依此类推
- [x] 登录页设计
- [x] 首次设置页设计
- [x] JWT 存储在 localStorage

## Task 6: 仪表盘 [x]

- [x] 后端：/api/dashboard 接口，收集系统信息
  - 使用 systeminformation 包获取 CPU、内存、磁盘、网络、OS 信息
- [x] 前端：仪表盘页面
  - 服务器概况卡片（OS、内核、运行时间、面板版本）
  - 资源使用率卡片（CPU 环形进度、内存进度条、磁盘进度条）
  - 网络流量展示
  - 各功能模块快捷入口卡片组

## Task 7: 安装脚本 [x]

- [x] Ubuntu Node.js 安装（nodesource 方式）
- [x] 创建 /opt/worm-panel/ 并复制文件
- [x] npm install --production
- [x] 写入 systemd unit
- [x] 启动服务

## Task 8: systemd 服务 [x]

- [x] 编写 worm-panel.service unit 文件
- [x] 支持 Restart=always
- [x] 使用 root 用户运行

## Task 9: WSL2 测试环境与验证

- [ ] 在 WSL2 Ubuntu 中安装 Node.js 20.x
- [ ] 在 WSL2 中安装 nginx 用于反测
- [ ] 在 WSL2 中全局安装 pm2
- [ ] 验证项目在 WSL2 中能正常启动（node app.js）
- [ ] 从 Windows 浏览器访问 http://wsl.localhost:4567 测试面板
- [ ] 标记：acme.sh 证书申请、3X-UI 整合不可在 WSL2 中测试
