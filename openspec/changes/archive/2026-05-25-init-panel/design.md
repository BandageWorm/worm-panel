# Init Panel — 设计文档

## UI 设计风格（参考宝塔面板）

```
┌─────────────────────────────────────────────────┐
│ 左上logo    │ 服务器名 │ CPU │ 内存 │ 磁盘 │ 时间 │  ← 顶部状态栏
├───────────┼─────────────────────────────────┤
│  ▌ 仪表盘  │                                         │
│  ▌ Nginx   │   卡片式内容区域                        │
│  ▌ SSL     │   ┌──────┐ ┌──────┐ ┌──────┐          │
│  ▌ 记事本  │   │ CPU  │ │ 内存 │ │ 磁盘 │          │
│  ▌ PM2    │   │ 45%  │ │ 62%  │ │ 78%  │          │
│  ▌ Workers│   └──────┘ └──────┘ └──────┘          │
│  ▌ 3X-UI  │   ┌──────────────────────┐             │
│  ▌ 设置    │   │ 系统信息             │             │
│  ▌        │   │ OS: Ubuntu 22.04     │             │
│  ▌        │   │ 运行时间: 12d 3h      │             │
│           │   └──────────────────────┘             │
│ 左侧导航   │                                         │
│ (深色背景) │                                         │
└───────────┴─────────────────────────────────────────┘
```

- **左侧导航**: 深色背景（#1a1a2e 或类似），图标+文字菜单
- **顶部状态栏**: 轻色背景，固定显示服务器运行状态
- **主内容区**: 白色/浅色卡片式布局
- **组件库**: Element Plus（与宝塔的组件风格接近，生态成熟）
- **图表**: 轻量方案，仪表盘用环形图+进度条即可，无需 ECharts

## 仪表盘设计

登录后的首页展示以下信息：

```
┌─ 服务器概况 ─────────────────────────────────┐
│  OS        Ubuntu 22.04.3 LTS x86_64          │
│  内核      5.15.0-generic                     │
│  运行时间  12 days 3 hours 42 minutes          │
│  面板版本  1.0.0                              │
│  面板模式  独立模式 :4567                      │
├─ 资源使用 ──────────────────────────────────┤
│  ┌ CPU    ████████░░░░ 45% ─┐ ┌ 内存          ─┐│
│  │ 8 vCPU                  │ │ 使用 3.2G / 8G  ││
│  └─────────────────────────┘ └─────────────────┘│
│  ┌ 磁盘   ████████████░ 78% ─┐ ┌ 网络          ─┐│
│  │ 使用 156G / 200G          │ │ 收 1.2MB/s     ││
│  └───────────────────────────┘ │ 发 340KB/s     ││
│                                └─────────────────┘│
├─ 快捷入口 ──────────────────────────────────┤
│  [Nginx管理] [SSL证书] [记事本] [PM2] [Workers]  │
└──────────────────────────────────────────────┘
```

## 目录结构

```
/opt/worm-panel/
├── app.js                    # 入口文件
├── package.json
├── src/
│   ├── index.js              # Express 应用初始化
│   ├── routes/
│   │   ├── auth.js           # 登录/登出/设置密码
│   │   ├── setup.js          # 首次设置
│   │   └── dashboard.js      # 仪表盘数据
│   ├── middleware/
│   │   └── auth.js           # JWT 验证中间件
│   ├── services/
│   │   ├── config.js         # 配置文件读写
│   │   ├── setup.js          # 初始化逻辑
│   │   └── monitor.js        # 系统资源监控
│   └── utils/
│       └── crypto.js         # bcrypt + JWT 工具
├── public/                   # Vue 3 构建产物
├── data/
│   └── config.json           # 面板配置
└── worm-panel.service
```

## 认证流程

```
POST /api/auth/login
  Body: { password: "xxx" }
  → bcrypt.compare → JWT sign → 返回 token

JWT payload: { sub: "admin", iat, exp }
JWT exp: 48h

所有 /api/* 路由（除 /api/auth/login, /api/setup）需验证 JWT
```

## config.json 结构

```json
{
  "version": 1,
  "initialized": false,
  "port": 4567,
  "mode": "standalone",
  "domain": null,
  "passwordHash": "",
  "setupToken": null
}
```

## 双模式

- **standalone 模式**: 监听 `0.0.0.0:4567`，HTTP 直连
- **proxy 模式**: 监听 `127.0.0.1:4567`，需 Nginx 反代

初始化时如果用户配置了域名，切换到 proxy 模式并自动生成 Nginx 配置。

## 仪表盘 API

```
GET /api/dashboard
  Response:
  {
    "system": {
      "os": "Ubuntu 22.04.3 LTS",
      "kernel": "5.15.0-generic",
      "uptime": 1234567,
      "hostname": "server1"
    },
    "cpu": {
      "usage": 45.2,
      "cores": 8,
      "model": "Intel Xeon..."
    },
    "memory": {
      "total": 8589934592,
      "used": 3435973837
    },
    "disk": {
      "total": 214748364800,
      "used": 167503724544,
      "mount": "/"
    },
    "network": {
      "rxBytes": 1258291,
      "txBytes": 348966
    },
    "panel": {
      "version": "1.0.0",
      "mode": "standalone",
      "uptime": 3600
    }
  }
```

## 安装脚本设计

```bash
install.sh 功能:
1. 检测 OS (Ubuntu)
2. 安装 Node.js (nodesource 或 nvm)
3. 创建 /opt/worm-panel/ 目录
4. 复制项目文件
5. npm install --production
6. 写入 systemd unit → systemctl enable
7. 启动服务 → 打印设置地址和 Token
```

## 本地开发与测试（WSL2）

本机 Windows 已安装 WSL2 Ubuntu，可在 WSL2 中进行开发验证和测试。

### WSL2 开发流程

```
1. 在 Windows 上编写代码（项目在 d:/script/worm_panel）
2. 项目文件从 Windows 侧访问 WSL2 中的文件：
   \\wsl.localhost\Ubuntu\opt\worm-panel\
   或将项目克隆到 WSL2 中直接开发
3. 在 WSL2 中启动面板测试：
   cd /opt/worm-panel
   node app.js
4. 从 Windows 浏览器访问 WSL2 IP：
   http://wsl.localhost:4567
   或通过 WSL2 的 IP 地址访问
```

### WSL2 测试环境准备

```bash
# WSL2 Ubuntu 内安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 nginx（用于测试反代功能）
sudo apt-get install -y nginx

# 安装 PM2（用于测试 PM2 管理）
sudo npm install -g pm2
```

### Windows 端工具

- VSCode 通过 Remote - WSL 插件直接连接 WSL2 开发
- Windows 浏览器访问 `http://wsl.localhost:4567` 测试面板
- 可用 `wsl` 命令在 Windows 终端中执行 WSL2 命令

### 注意事项

- WSL2 中的 systemd 默认未启用，测试时直接 `node app.js` 启动
- Nginx 在 WSL2 中可直接安装运行
- acme.sh 证书申请在 WSL2 中无法完成（需要公网 IP + 80 端口），此功能需在真实服务器测试
- 3X-UI 在 WSL2 中可能无法运行，状态检测可 mock

## systemd unit

```ini
[Unit]
Description=Worm Panel
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/worm-panel
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```
