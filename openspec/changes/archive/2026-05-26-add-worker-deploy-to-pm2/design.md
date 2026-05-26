## Context

之前删除了独立的 Workers 模块（wrangler + Cloudflare 部署）。用户需要在面板中直接输入 GitHub 仓库地址，通过 miniflare + PM2 在 VPS 本地运行 Worker 项目。部署后的进程出现在现有 PM2 进程列表中，复用已有的管理功能（重启/停止/日志）。

## Goals / Non-Goals

**Goals:**
- 在 PM2 页面添加"从 GitHub 部署 Worker"按钮 + 对话框
- 后端支持 git clone → npm install → pm2 start miniflare 流程
- 部署记录持久化到 `data/workers.json`
- 部署的进程自动出现在 PM2 进程列表

**Non-Goals:**
- 不创建独立的 Workers 页面
- 不修改 miniflare 安装方式（安装脚本中已 `npm install -g miniflare`）
- 不涉及端口自动分配（用户指定，冲突时报错）
- 不实现进程监控告警

## Decisions

| 决策 | 选项 | 选择理由 |
|------|------|----------|
| 存储方式 | config.json vs 独立文件 | **独立 `data/workers.json`** — 与面板配置解耦，避免 config.json 膨胀 |
| 后端结构 | 追加到 PM2 路由 vs 新模块 | **新模块 `gitworker`** — git 操作与 PM2 进程管理职责不同，独立更清晰 |
| PM2 启动方式 | programmatic API vs execSync | **programmatic API** — 与现有 pm2 服务一致，可复用 connect/disconnect 模式 |
| miniflare 调用 | `npx miniflare` vs `miniflare` | **`npx miniflare`** — npx 自动处理 PATH 解析，即使全局未安装也可用 |
| 进程管理 | 仅 deploy vs deploy + list + remove | **三个端点** — deploy 创建，list 查看记录，remove 清理（stop + 删文件） |

## Risks / Trade-offs

- **[风险]** PM2 中 npx PATH 不可用 → **缓解**: 传递 `env: { PATH: resolveNvmPath() }`，包含 nvm bin 目录
- **[风险]** git clone 超时（大仓库） → **缓解**: 设置 120s 超时，Worker 项目通常较小
- **[风险]** 项目名与现有 PM2 进程冲突 → **缓解**: deploy 前检查已存记录和 PM2 进程列表
- **[风险]** npm install 失败 → **缓解**: 非致命，记录警告后继续尝试启动
