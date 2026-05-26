## Context

当前 Workers 模块包含一套完整的部署流程（git clone → wrangler deploy → Cloudflare），需要 wrangler CLI 和 Cloudflare API Token。实际使用中 Worker 项目通过 miniflare + PM2 在 VPS 本地运行，无需部署到 Cloudflare。面板已有 PM2 管理模块，可以直接管理 miniflare 进程。此变更删除 Workers 模块全部代码和配置。

## Goals / Non-Goals

**Goals:**
- 删除 Workers 路由、服务层、前端页面
- 从 config.json 中移除 Workers 相关配置项
- 从安装/部署脚本中移除 wrangler 和 Workers 目录
- 归档 Workers 规格文档

**Non-Goals:**
- 不修改 PM2 管理模块
- 不添加任何新功能

## Decisions

| 决策 | 选项 | 选择理由 |
|------|------|----------|
| Workers 配置项处理 | 保留 vs 清理 | **清理** — `cloudflareApiToken` 和 `workers` 数组不再被任何代码引用，保留只会造成困惑 |
| 已有克隆仓库处理 | 手动删除 vs 脚本自动清理 | **手动删除** — 服务器上 `data/workers/` 目录可能包含有价值的代码，由用户自行决定是否清理。脚本不做自动删除 |
| wrangler 安装 | 移除 vs 替换为 miniflare | **替换为 miniflare** — 安装脚本中 `npm install -g miniflare` 替代 wrangler，用于在 VPS 本地运行 Worker 项目 |
| 规格文档 | 删除 vs 归档 | **归档** — 通过 OpenSpec 变更归档流程存档，保留历史记录 |

## Risks / Trade-offs

- **[风险]** 用户可能正在使用 Workers 页面管理项目 → **缓解**: 纯删除，无平滑迁移路径。用户需自行通过 PM2 + miniflare 替代
- **[风险]** 已有 `data/workers/` 目录和克隆仓库成为孤儿数据 → **缓解**: 脚本不做自动清理，用户自行决定
- **[兼容性]** `cloudflareApiToken` 从 config.json 移除 → 如果用户降级回旧版本需要重新配置
