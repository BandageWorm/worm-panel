# Workers Deploy — Cloudflare Workers 部署管理

## 目标

在面板中管理多个 Cloudflare Workers 项目，支持从 GitHub 克隆代码并触发部署。

## 范围

- Workers 项目管理（添加、删除、列表）
- 从 GitHub 克隆仓库到本地（git clone）
- 触发部署（git pull → npx wrangler deploy）
- 部署日志展示
- Wrangler 环境检测（npx wrangler --version）

## 非目标

- 不管理 Cloudflare API Token 配置（假设已配置）
- 不提供代码编辑器
- 不管理 Wrangler 配置文件（wrangler.toml）的生成
- 不支持多环境（dev/prod）部署
