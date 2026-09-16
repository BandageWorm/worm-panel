## Why

目前面板的文件下载（`/api/files/download`、`/api/drive/download`）全部要求携带 `Authorization: Bearer <token>` 请求头，无法直接把 URL 分享给他人、粘贴到下载器或用浏览器直接打开。缺少一个"生成即可分享"的直链能力：自用场景下需要上传文件后拿到一条无需登录即可访问的下载链接，类似云存储的分享链接。

## What Changes

- 新增独立模块「文件直链」，提供一个专用存储目录（`data/directlink/`），与文件管理器、备份盘（drive）互不干扰。
- 提供管理接口（走 JWT，仅面板内使用）：上传文件并生成直链、列出所有直链、删除直链。
- 提供公开直链接口 `GET /d/:token`（**无需登录**），核心特性：
  - 通过不可猜测的随机 token 访问（方案 A：靠 URL 保密，适合自用）。
  - 支持 HTTP `Range` 断点续传（下载暂停后可续传，下载器友好）。
  - 通过 `Content-Disposition` 还原原始文件名（含中文）。
- 上传为普通一次性上传，大小上限 500MB（与备份盘一致）。
- 每条直链支持**可选过期时间**（`expiresAt`），不填即永久；过期后访问返回失效响应。
- 前端左侧导航新增「文件直链」页面：上传、列表、一键复制直链、删除。

**边界（不做什么）：**
- 不做上传断点续传/分片上传（普通一次性上传即可）。
- 不做提取码、下载次数限制、带宽限流等高强度分享控制。
- 不追求高并发，自用为主。
- 不复用备份盘目录，直链文件不参与 WebDAV 同步。

## Capabilities

### New Capabilities
- `direct-link-download`: 文件直链下载能力。涵盖直链文件的上传与专用存储、随机 token 生成与元信息管理、公开无鉴权的 `/d/:token` 下载（含 Range 断点续传与原文件名还原）、可选过期时间、以及直链的列出与删除。

### Modified Capabilities
<!-- 无：本变更为独立新增模块，不改变已有能力的 spec 级行为 -->

## Impact

- **后端新增**：
  - `src/services/directlink.js`：token 生成、`index.json` 元信息读写、专用目录管理、过期判断。
  - `src/routes/directlink.js`：管理接口（`GET /api/directlink`、`POST /api/directlink/upload`、`DELETE /api/directlink/:token`）。
  - 公开直链路由 `GET /d/:token`（不挂 `authMiddleware`）。
- **后端修改**：
  - `src/index.js`：注册 `/api/directlink`（走 JWT）与公开 `/d/:token` 路由；**关键约束**——`/d/:token` 必须注册在 SPA fallback（`app.get('*')`）之前，否则会被前端路由拦截。
- **前端新增**：
  - `client/src/views/DirectLinkManager.vue`：上传/列表/复制/删除页面。
  - `client/src/router/index.js`、`client/src/layouts/MainLayout.vue`：新增「文件直链」导航项与路由。
  - `client/src/api/index.js`：对应 API 封装。
- **数据/运行时**：
  - 新增 `data/directlink/files/`（实际文件，文件名用 token）与 `data/directlink/index.json`（token → 元信息映射）。
- **依赖**：复用现有 `multer`（上传）与 Node 内置 `fs`（Range 流式读取），无新增第三方依赖。
