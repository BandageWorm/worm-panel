# Worm Panel

轻量级服务器管理面板，适合个人 VPS 日常运维。

## 功能

- **仪表盘** — CPU、内存、磁盘、网络实时概览
- **文件管理** — Web 文件浏览器，上传/下载/编辑
- **Web 终端** — 浏览器内 SSH 终端
- **防火墙** — ufw 规则可视化管理
- **Nginx 管理** — 反向代理可视化配置 + 原生文本编辑
- **SSL 证书** — acme.sh 一键申请/续期
- **计划任务** — crontab 可视化管理，支持立即执行和历史记录
- **PM2 管理** — Node.js 进程管理、日志查看
- **记事本** — Markdown 笔记
- **3X-UI** — 状态查看 + Nginx 反代入口
- **云备份** — 阿里云盘 WebDAV 备份

## 技术栈

- 后端: Node.js + Express
- 前端: Vue 3 + Vite + Element Plus
- 部署: systemd 管理，单端口 4567 服务

## 一键安装

在新 VPS (Ubuntu/Debian) 上以 root 执行：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/BandageWorm/worm-panel/main/scripts/install-online.sh)
```

安装完成后访问 `http://你的IP:4567/#/setup`，使用日志中打印的 Setup Token 完成初始化。

## 手动安装

```bash
curl -fsSL https://github.com/BandageWorm/worm-panel/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 -C /opt/worm-panel
cd /opt/worm-panel
bash scripts/install.sh
```

## 管理命令

```bash
systemctl status worm-panel     # 查看状态
systemctl restart worm-panel    # 重启
journalctl -u worm-panel -f     # 查看日志
```

## 开发

本地开发环境为 Windows，通过 WSL2 Ubuntu 测试运行。

```bash
# 前端开发
cd client && npm install && npm run dev

# 前端构建
cd client && npm run build

# WSL2 中启动后端
node app.js
# Windows 浏览器访问 http://wsl.localhost:4567
```

## 部署更新

```bash
# 创建 .env 文件（参考 .env.example）
bash scripts/sync-and-deploy.sh
```

增量推送修改文件到服务器并自动重启。

## 目录结构

```
├── app.js                    # 入口
├── src/
│   ├── index.js              # Express 应用
│   ├── routes/               # API 路由
│   ├── services/             # 业务逻辑
│   ├── middleware/           # JWT 认证
│   └── utils/                # 工具函数
├── client/src/               # Vue 3 前端
├── scripts/                  # 安装/部署脚本
├── public/                   # 前端构建产物
└── data/                     # 运行时数据
```

## License

MIT
