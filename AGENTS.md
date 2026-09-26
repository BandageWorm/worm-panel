# Worm Panel

服务器管理 Web 面板，用于管理 nginx 反代、SSL 证书、计划任务、PM2/Systemd 进程、文件与云备份等。

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
| 文件管理 | Web 文件浏览器：上传/下载/删除/新建目录/在线编辑 |
| 文件直链 | 上传文件生成无需登录的公开直链，支持 Range 断点续传与可选过期 |
| 终端 | 浏览器内 WebSocket + pty 交互式 bash |
| 防火墙 | ufw 规则可视化管理，保护面板自身端口不被误删 |
| Nginx 管理 | 可视化添加反代 + 原生文本编辑器，nginx -t 验证后 reload |
| SSL 证书 | acme.sh 一键申请，自动配置到 Nginx |
| 计划任务 | crontab 可视化管理，支持立即执行和历史记录 |
| 记事本 | Markdown，文件系统存储于 data/notes/ |
| 云备份 | 阿里云盘（aliyundrive-webdav + rclone）备份，含本地备份盘 |
| PM2 管理 | 进程列表、重启/停止、配置编辑、日志查看 |
| Systemd 管理 | 服务列表、启停、开机自启、日志查看 |
| 3X-UI | 运行状态查看 + Nginx 反代入口 |
| 系统设置 | 域名、端口、模式、密码修改与面板重启 |

## 部署流程

**每次代码修改完成后，必须立即自动执行 auto-deploy，无需询问用户、无需等待确认。**

在 Windows 下通过 WSL 运行（脚本自带非 WSL 环境守卫）：

```bash
wsl -e bash -lc "bash /mnt/d/Project/worm-panel/scripts/auto-deploy.sh"
```

`scripts/auto-deploy.sh` 是一键部署入口（内部复用 `scripts/sync-and-deploy.sh`），流程为：
1. 加载仓库根 `.env` 中的 `DEPLOY_SERVER` / `DEPLOY_DIR`，SSH 预检
2. 自动检测 git 中修改/新增的文件（`git status --porcelain`，按 `.env` 与内置规则排除 public/、data/、openspec/、test/ 等）
3. scp 增量推送到服务器的暂存目录 `/root/worm-panel`
4. SSH 执行 `scripts/deploy.sh`：rsync 到运行目录 `/opt/worm-panel` → 安装依赖 → 构建前端 → 重启 systemd 服务
5. 部署后自检：systemd 状态、面板 HTTP 可达性、核心模块行为

常用参数：
- `--dry-run` 仅列出将同步的文件，不推送
- `--verify-only` 仅做部署后自检
- `--skip-verify` 跳过部署后自检

- 部署配置写在仓库根 `.env`（不纳入版本控制）
- 部署失败时必须明确报告失败步骤与原因，不得静默跳过
- systemd service 管理
- 安装脚本使用 nvm 安装 Node.js 22.x
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
    ├── config.json / notes/ / backups/nginx/ / logs/ / drive/ / cron-history/ / directlink/ / ssl/
```

## 开发约定

- Nginx 配置操作流程: 生成/修改 → nginx -t 验证 → nginx -s reload
- Nginx 命令遇到 Permission denied 自动重试加 sudo（WSL2 兼容）
- 修改 Nginx 配置前自动备份，保留最近 30 份
- 除 /api/auth/login 和 /api/setup/* 外，所有 API 需 JWT Bearer token
- 归档 OpenSpec 变更时：先同步 delta specs 到主 specs，再归档
- 每次改完代码立即执行 auto-deploy（见上方「部署流程」），不要等用户要求
- UI需要支持响应式布局，手机端方便访问
- 不使用Courier New字体
