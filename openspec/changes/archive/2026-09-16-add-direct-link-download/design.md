## Context

见 proposal.md - Why。现有下载接口（`/api/files/download`、`/api/drive/download`）均经过 `authMiddleware`，需要 `Authorization: Bearer` 头，无法直接分享。本设计新增独立的直链模块，其中公开下载端点是唯一一处**不经过 JWT 鉴权**的业务路由，需要特别处理路由注册顺序与安全边界。

关键约束（来自 `src/index.js`）：
- 所有受保护路由通过 `app.use('/api/xxx', authMiddleware, require(...))` 注册。
- 末尾存在 SPA 兜底：`app.get('*', ...)`，将非 `/api` 开头的路径返回 `index.html`。因此公开直链路由必须在此兜底之前注册。
- 上传已有成熟范式：`multer` + `diskStorage`（见 `src/routes/drive.js`）。

## Goals / Non-Goals

**Goals:**
- 公开直链无需登录即可下载，通过不可猜测 token 保护。
- 下载支持 `Range` 断点续传，复用 Node 内置 `fs.createReadStream`。
- 直链模块与文件管理器 / 备份盘完全隔离，独立目录、独立元信息。
- 无新增第三方依赖（复用 `multer`、`fs`）。

**Non-Goals:**
- 不做上传断点续传 / 分片上传。
- 不做提取码、下载次数上限、限速等强分享控制。
- 不做过期文件的自动物理清理调度（过期后访问即拒绝；物理清理留待手动删除或后续增强）。

## Decisions

### D1: 存储布局 — token 作为物理文件名 + 独立 index.json

```
data/directlink/
├── files/
│   ├── aB3xK9mP        # 物理文件名 = token（无扩展名，避免歧义）
│   └── Qz7Yw2Lt
└── index.json          # { token: { originalName, size, mime, createdAt, expiresAt } }
```

- **为何用 token 当文件名**：彻底规避同名覆盖、中文/特殊字符文件名、路径穿越问题；原始文件名仅存于 `index.json`，下载时通过 `Content-Disposition` 还原。
- **为何用单个 index.json**：自用、量小、不追求并发。整文件读写 + 内存操作足够简单可靠；写入采用"读改写"，与项目其他 JSON 存储（如 `data/config.json`、`data/workers.json`）风格一致。
- **备选**：每文件一个 `.meta.json`（更抗并发但更碎）——量小场景不值当。

### D2: token 生成 — crypto 随机 URL-safe 字符串

- 使用 Node 内置 `crypto.randomBytes` 生成，映射到 `[A-Za-z0-9]`，长度 10 位左右（约 62^10 组合，自用绝对够）。
- 生成后校验 `index.json` 无碰撞，极小概率碰撞时重试。
- **为何不用 UUID**：URL 更短更干净；不可猜测性由 `crypto` 随机保证。

### D3: 路由划分 — 管理走 /api/directlink（JWT），下载走 /d/:token（公开）

```
src/index.js 注册顺序（关键）：
  app.use('/api/directlink', authMiddleware, require('./routes/directlink'))  # 管理
  app.get('/d/:token', require('./routes/directlink').publicDownload)          # 公开，必须在 SPA fallback 之前
  ...
  app.get('*', SPA fallback)                                                   # 末尾
```

- 管理接口：`GET /api/directlink`（列表）、`POST /api/directlink/upload`、`DELETE /api/directlink/:token`。
- 公开下载：`GET /d/:token`，不挂 `authMiddleware`。
- **为何用 `/d/` 而非 `/api/dl/`**：URL 更短，适合分享；只要注册在 SPA fallback 之前即可正确路由。
- 模块导出方式：`directlink` 路由模块导出一个 Express `Router`（管理接口）与一个独立的 `publicDownload` 处理函数，供 `index.js` 分别挂载。

### D4: Range 断点续传实现

- 响应始终带 `Accept-Ranges: bytes`。
- 无 `Range` 头：200 + `Content-Length` = 文件大小 + `fs.createReadStream(file).pipe(res)`。
- 有 `Range: bytes=start-[end]`：解析 start/end（end 缺省=文件末尾），校验区间：
  - 合法 → 206 + `Content-Range: bytes start-end/size` + `Content-Length` = 区间长度 + `fs.createReadStream(file, { start, end })`。
  - 非法（start ≥ size）→ 416 + `Content-Range: bytes */size`。
- `Content-Disposition: attachment; filename*=UTF-8''<encodeURIComponent(originalName)>`（沿用 drive.js 的中文文件名处理方式）。

### D5: 过期判断

- `expiresAt` 存 ISO 字符串或 null（永久）。
- 公开下载时先查 `index.json`：token 不存在 → 404；存在但 `expiresAt` 已过 → 返回失效（选用 404，避免暴露"曾存在"的信息，符合"靠 URL 保密"的方案 A 思路）。
- 过期文件的物理清理不在本次范围（Non-Goal），仅在访问层拒绝。

### D6: 前端

- 新增 `client/src/views/DirectLinkManager.vue`：上传（可选设置过期时间）、列表（文件名/大小/创建时间/过期/直链）、一键复制直链、删除。
- 直链 URL 由后端返回完整地址（基于请求的 host 拼接），前端直接展示与复制。
- 在 `router/index.js` 与 `MainLayout.vue` 导航新增「文件直链」项，归入文件相关分组；遵循项目响应式布局约定，移动端可用。

## Risks / Trade-offs

- **[公开端点被扫描/枚举]** → token 由 `crypto` 生成、长度足够，62^10 空间不可暴力枚举；自用场景可接受。可选过期时间进一步降低长期暴露风险。
- **[index.json 并发写覆盖]** → 自用、低频，读改写窗口极小；风险可接受。若未来需要可加写锁或改为逐文件元信息。
- **[大文件下载占用连接]** → 使用流式 `createReadStream` 而非一次性读入内存，内存可控；不追求高并发，符合定位。
- **[路由注册顺序错误导致直链被 SPA 拦截]** → 在 design 与 tasks 中显式标注注册顺序约束，实现时重点验证 `/d/:token` 命中后端而非返回 index.html。
- **[过期文件物理堆积]** → 本次仅访问层拒绝，不自动清理；通过删除接口手动清理，后续可加定时清理增强。
