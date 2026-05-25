# Worm Panel

服务器管理 Web 面板，用于管理 nginx 反代、PM2 进程、SSL 证书、Workers 部署等。

## 技术栈

- 后端: Node.js (Express)
- 前端: Vue 3 + Vite + Element Plus
- 打包: 前端静态文件由后端托管，单端口服务
- UI 风格: 参考宝塔面板（左侧深色导航 + 顶部状态栏 + 卡片式内容区）

## 项目范围

- 支持双模式：无域名时 HTTP+端口访问，有域名时 Nginx 反代 HTTPS
- 默认端口: 4567
- 认证: bcrypt 哈希存密码，JWT 48h 过期
- 所有 nginx 操作自动备份，面板自身反代配置锁定不可删除
- 不追求高强度安全，基础防护即可

## 模块清单

| 模块 | 职责 |
|------|------|
| 仪表盘 | 系统概览：CPU、内存、磁盘、网络、快捷入口 |
| Nginx 管理 | 可视化添加反代 + 原生文本编辑器，nginx -t 验证后 reload |
| SSL 证书 | acme.sh 一键申请，自动配置到 Nginx |
| 记事本 | Markdown，文件系统存储于 data/notes/ |
| PM2 管理 | 进程列表、重启/停止、编辑 ecosystem.config.js、日志查看 |
| Workers 部署 | 从 GitHub clone 项目 → npx wrangler deploy |
| 3X-UI | 运行状态查看 + Nginx 反代入口 |

## 安装方式

- systemd service 管理
- 安装脚本使用 nvm 安装 Node.js 20.x
- 首次启动生成设置 Token 打印在日志中，通过 /#/setup 完成初始化

## 本地开发与测试

- 开发环境: Windows，通过 WSL2 Ubuntu 验证测试
- 测试方式: WSL2 中启动 `node app.js` → Windows 浏览器访问 `http://wsl.localhost:4567`
- 前端修改后需 `cd client && npm run build` 重新构建
- acme.sh 和 3X-UI 功能无法在 WSL2 中完整测试，需真实服务器

## 目录结构

```
/opt/worm-panel/
├── app.js                        # 入口文件
├── package.json
├── scripts/
│   └── install.sh                # 安装脚本
├── worm-panel.service            # systemd unit
├── src/
│   ├── index.js                  # Express 应用初始化
│   ├── routes/                   # API 路由
│   │   ├── auth.js               # 登录
│   │   ├── setup.js              # 首次设置
│   │   ├── dashboard.js          # 仪表盘
│   │   ├── nginx.js              # Nginx 站点管理
│   │   ├── ssl.js                # SSL 证书
│   │   ├── notes.js              # 记事本
│   │   ├── pm2.js                # PM2 进程
│   │   ├── workers.js            # Workers 部署
│   │   └── xui.js                # 3X-UI
│   ├── services/                 # 业务逻辑
│   │   ├── config.js             # 配置读写
│   │   ├── setup.js              # 初始化 Token
│   │   ├── monitor.js            # 系统监控
│   │   ├── nginx.js              # Nginx 操作（自动 sudo 回退）
│   │   ├── acme.js               # acme.sh 封装
│   │   ├── notes.js              # 笔记文件操作
│   │   ├── pm2.js                # PM2 API 封装
│   │   ├── workers.js            # Git + wrangler
│   │   └── xui.js                # 3X-UI 检测与反代
│   ├── middleware/
│   │   └── auth.js               # JWT 验证
│   └── utils/
│       └── crypto.js             # bcrypt + JWT 工具
├── client/                        # Vue 3 前端
│   ├── package.json / vite.config.js / index.html
│   └── src/
│       ├── main.js / App.vue
│       ├── router/index.js       # 路由（懒加载）
│       ├── api/index.js          # HTTP 客户端
│       ├── layouts/MainLayout.vue
│       └── views/
│           ├── Login.vue / Setup.vue
│           ├── Dashboard.vue
│           ├── NginxManager.vue
│           ├── SslManager.vue
│           ├── NotesManager.vue
│           ├── Pm2Manager.vue
│           ├── WorkersManager.vue
│           ├── XuiManager.vue
│           └── Placeholder.vue
├── public/                        # 前端构建产物
└── data/
    ├── config.json                # 面板配置
    ├── notes/                     # 笔记存储
    ├── backups/nginx/             # Nginx 配置备份
    ├── logs/                      # 应用日志
    └── workers/                   # 克隆的 Worker 项目
```

## 开发约定

- Nginx 配置操作流程: 生成/修改 → nginx -t 验证 → nginx -s reload
- Workers 部署流程: git pull → npx wrangler deploy
- Nginx 命令遇到 Permission denied 自动重试加 sudo（WSL2 兼容）
- 修改 Nginx 配置前自动备份，保留最近 30 份
- 除 /api/auth/login 和 /api/setup/* 外，所有 API 需 JWT Bearer token
