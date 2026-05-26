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

## 部署流程

代码修改后运行 `bash scripts/sync-and-deploy.sh` 自动部署到生产服务器：
1. 自动检测 git 中修改/新增的文件
2. scp 增量推送到服务器的 /root/worm-panel
3. SSH 执行 deploy.sh 构建并重启面板

- systemd service 管理
- 安装脚本使用 nvm 安装 Node.js 20.x
- 首次启动生成设置 Token 打印在日志中，通过 /#/setup 完成初始化

## 本地开发与测试

- 开发环境: Windows，通过 WSL2 Ubuntu 验证测试
- 测试方式: WSL2 中启动 `node app.js` → Windows 浏览器访问 `http://wsl.localhost:4567`，不得在 Windows 原生环境运行
- 前端修改后需 `cd client && npm run build` 重新构建

## 目录结构

```
/opt/worm-panel/
├── app.js                    # 入口
├── package.json
├── scripts/                  # 部署/安装脚本
├── worm-panel.service        # systemd unit
├── src/
│   ├── index.js              # Express 应用初始化
│   ├── routes/               # API 路由（按模块划分）
│   ├── services/             # 业务逻辑层
│   ├── middleware/auth.js    # JWT 验证
│   └── utils/crypto.js      # bcrypt + JWT 工具
├── client/src/               # Vue 3 前端源码
│   ├── router/ / api/ / layouts/
│   └── views/                # 页面组件（模块划分同 routes）
├── public/                   # 前端构建产物
└── data/                     # 运行时数据
    ├── config.json / notes/ / backups/nginx/ / logs/ / workers/
```

## 开发约定

- Nginx 配置操作流程: 生成/修改 → nginx -t 验证 → nginx -s reload
- Workers 部署流程: git pull → npx wrangler deploy
- Nginx 命令遇到 Permission denied 自动重试加 sudo（WSL2 兼容）
- 修改 Nginx 配置前自动备份，保留最近 30 份
- 除 /api/auth/login 和 /api/setup/* 外，所有 API 需 JWT Bearer token
- 归档 OpenSpec 变更时：先同步 delta specs 到主 specs，再归档
- UI需要支持响应式布局，手机端方便访问
