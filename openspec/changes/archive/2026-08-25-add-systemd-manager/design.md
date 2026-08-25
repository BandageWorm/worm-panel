## Context

面板已有成熟的模块化架构：routes 层负责 HTTP 路由和错误处理，services 层封装业务逻辑。所有受保护路由通过 `authMiddleware` 统一鉴权。现有 PM2 模块通过 pm2 npm 包连接，Nginx/Cron 等模块通过 `child_process.execFile` 调用系统命令。Systemd 模块将复用后者模式。

服务器环境为 Ubuntu Linux，systemctl 和 journalctl 命令可用。面板进程以 Node.js 运行，systemctl 写操作需要 sudo 权限（与 Nginx 模块处理方式一致）。

## Goals / Non-Goals

**Goals:**

- 提供完整的 systemd service 只读查询（列表、详情、日志）
- 提供 start/stop/restart/reload/enable/disable 写操作
- 与现有模块保持一致的代码风格和架构模式
- worm-panel.service 自保护

**Non-Goals:**

- 不做 systemd unit 文件的编辑/创建（复杂度高，可后续迭代）
- 不做实时日志流（WebSocket），仅提供最近 N 行静态查询
- 不管理非 service 类型的 unit（timer、socket、mount 等）
- 不做 systemd user session 管理，仅管理系统级服务

## Decisions

### 1. 使用 child_process.execFile 调用 systemctl CLI

**选择**: 直接调用 `systemctl` / `journalctl` 命令，解析输出

**替代方案**: 使用 D-Bus API（systemd 原生接口）

**理由**: CLI 方式与面板现有模块（nginx、cron）风格一致，无需引入新依赖（如 dbus-native npm 包），实现简单可靠。CLI 的 `--output=json` 参数可提供结构化输出，满足需求。

### 2. 列表使用 systemctl list-units --type=service --all --output=json

**选择**: `--all` 显示所有 loaded 的 service，`--output=json` 获取结构化数据

**替代方案**: `list-unit-files` 显示所有已安装的 unit

**理由**: `list-units` 返回当前加载的服务及其运行状态，更贴合「管理正在运行或近期活动的服务」场景。`list-unit-files` 会包含大量从未启动的模板和别名，噪音太多。

### 3. sudo 处理策略

**选择**: 写操作（start/stop/restart/reload/enable/disable）统一加 `sudo` 前缀，读操作（list-units/show/journalctl）不加 sudo

**理由**: systemctl 读操作不需要 root 权限；写操作需要。面板部署时安装脚本已配置 sudoers 免密（与 nginx reload 相同处理方式）。

### 4. 前端排序和过滤在前端实现

**选择**: 后端一次性返回完整列表，前端做搜索/筛选/排序

**替代方案**: 后端分页 + 服务端过滤

**理由**: 典型服务器的 loaded service 数量在 50-150 个之间，数据量小，全量返回到前端处理更简单高效，避免多次 API 调用。后端仅做初始排序（active 在前）。

### 5. worm-panel.service 保护在后端强制执行

**选择**: 后端 service 层硬编码保护逻辑，对 worm-panel.service 拒绝 stop 和 disable 操作

**替代方案**: 仅前端隐藏按钮

**理由**: 安全检查必须在后端执行，防止直接调用 API 绕过前端限制。前端同时做 UI 层面的提示和确认弹窗。

### 6. 日志查询使用 journalctl -u

**选择**: `journalctl -u <service> --no-pager -n <lines> --output=short`

**理由**: short 格式可读性好，`-n` 参数控制行数避免大量输出。不做实时流，按需刷新即可满足日常排查需求。

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    前端 (Vue 3)                       │
│  SystemdManager.vue                                  │
│  ┌─────────────┬──────────────┬───────────────────┐ │
│  │ 搜索/过滤   │  服务列表表格  │  详情/日志抽屉   │ │
│  └─────────────┴──────────────┴───────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP API
┌──────────────────────┼──────────────────────────────┐
│  src/routes/systemd.js (路由层)                      │
│  - 参数校验                                          │
│  - 错误处理                                          │
│  - worm-panel 保护提示                               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────┐
│  src/services/systemd.js (业务层)                    │
│  - execFile 封装                                     │
│  - JSON 解析                                         │
│  - 保护逻辑                                          │
│  - sudo 处理                                         │
└──────────────────────┬──────────────────────────────┘
                       │ child_process.execFile
                       ▼
              systemctl / journalctl
```

## API Design

| Method | Path | 说明 |
|--------|------|------|
| GET | /api/systemd/services | 服务列表 |
| GET | /api/systemd/services/:name | 服务详情 |
| GET | /api/systemd/services/:name/logs | 服务日志（query: lines=100） |
| POST | /api/systemd/services/:name/start | 启动 |
| POST | /api/systemd/services/:name/stop | 停止 |
| POST | /api/systemd/services/:name/restart | 重启 |
| POST | /api/systemd/services/:name/reload | 重载 |
| POST | /api/systemd/services/:name/enable | 启用开机自启 |
| POST | /api/systemd/services/:name/disable | 禁用开机自启 |

## Risks / Trade-offs

- **[systemctl JSON 输出兼容性]** → 较老版本 systemd 可能不支持 `--output=json`。缓解：检测输出格式，fallback 到文本解析。实际风险低，目标服务器 Ubuntu 22.04+ systemd 版本足够新。
- **[重启面板导致连接断开]** → 用户重启 worm-panel.service 后前端失联。缓解：前端二次确认弹窗明确告知「重启后需重新登录」，并在断开后自动跳转登录页。
- **[服务名注入风险]** → 服务名来自 URL 参数，需校验。缓解：正则校验服务名格式（仅允许 `[a-zA-Z0-9@._-]+`），拒绝非法字符。
