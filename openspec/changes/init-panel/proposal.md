# Init Panel — 面板骨架核心

## 目标

搭建 Worm Panel 的基础骨架，包括项目初始化、目录结构、认证系统、配置管理、安装脚本和 systemd 服务。

## 范围

- Node.js 项目初始化（Express + Vue 3）
- 目录结构搭建（/opt/worm-panel/ 布局）
- bcrypt 密码哈希 + JWT 48h 认证
- 配置文件 data/config.json 管理
- setup 初始化流程（首次启动生成 Token）
- 双模式支持（无域名 HTTP 直连 / 有域名 Nginx 反代）
- 安装脚本（含 Node.js 环境安装）
- systemd unit 文件

## 非目标

- 不包含任何功能模块（nginx/ssl/pm2/笔记/workers/xui）
- 不包含前端 UI 细节，只搭建基础路由和登录页骨架
