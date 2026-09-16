## 1. 后端服务层

- [x] 1.1 创建 `src/services/directlink.js`：初始化 `data/directlink/files/` 目录与 `data/directlink/index.json`，实现 `crypto` 随机 URL-safe token 生成（约 10 位，写入前查重防碰撞）。验证：Node REPL 调用生成函数多次返回不重复的 `[A-Za-z0-9]` token，目录与 index.json 首次访问被自动创建。
- [x] 1.2 在 `directlink.js` 中实现 index.json 元信息读写（读改写）：`add(token, meta)`、`list()`、`get(token)`、`remove(token)`，meta 含 `originalName/size/mime/createdAt/expiresAt`。验证：新增后 `list()`/`get()` 可读到；`remove()` 后 `get()` 返回空且物理文件被删除。
- [x] 1.3 在 `directlink.js` 中实现过期判断 `isExpired(meta)`（`expiresAt` 为 null 视为永久）。验证：构造带过去/未来/null 的 expiresAt 分别返回 true/false/false。

## 2. 后端路由层

- [x] 2.1 创建 `src/routes/directlink.js`，导出管理用 Express `Router`：`POST /upload`（multer diskStorage 存入 files/、上限 500MB、生成 token、返回 token 与完整直链 URL）、`GET /`（列表，每条含完整直链 URL）、`DELETE /:token`（删除文件+记录）。验证：带 JWT 依次调用上传/列表/删除，行为符合 spec 中对应 Scenario；超 500MB 返回 413，缺文件返回 400。
- [x] 2.2 在 `src/routes/directlink.js` 中实现并导出公开下载处理函数 `publicDownload`：查 index → 不存在或已过期返回 404；设置 `Accept-Ranges: bytes` 与 `Content-Disposition`（UTF-8 还原原文件名）；无 Range 返回 200 全量流，有合法 Range 返回 206 + `Content-Range`，非法 Range 返回 416。均用 `fs.createReadStream` 流式输出。验证：curl 分别测试无 Range(200)、`Range: bytes=100-`(206+Content-Range)、越界 Range(416)、过期/不存在 token(404)。

## 3. 应用装配

- [x] 3.1 在 `src/index.js` 注册路由：`app.use('/api/directlink', authMiddleware, directlinkRouter)` 与公开 `app.get('/d/:token', publicDownload)`，且 `/d/:token` 必须位于 SPA 兜底 `app.get('*')` 之前、不挂 authMiddleware。验证：未登录 GET `/d/<有效token>` 返回文件内容而非前端 index.html；未登录访问 `/api/directlink` 返回 401。

## 4. 前端

- [x] 4.1 在 `client/src/api/index.js` 新增直链 API 封装（上传含可选 expiresAt、列表、删除）。验证：构建通过，方法签名与后端接口一致。
- [x] 4.2 创建 `client/src/views/DirectLinkManager.vue`：上传（可选设置过期时间）、列表展示（文件名/大小/创建时间/过期/直链）、一键复制直链、删除确认；遵循响应式布局、移动端可用、不使用 Courier New 字体。验证：`cd client && npm run build` 成功。
- [x] 4.3 在 `client/src/router/index.js` 与 `client/src/layouts/MainLayout.vue` 新增「文件直链」导航项与路由，归入文件相关分组。验证：本地运行后左侧导航出现「文件直链」，点击进入页面正常渲染。

## 5. 集成验证

- [x] 5.1 端到端验证（WSL2 中 `node app.js`，Windows 浏览器访问）：登录后上传文件→复制直链→新开无痕/无登录标签访问直链能下载→下载器暂停后续传成功→设置短过期时间的直链过期后访问返回失效→删除后直链立即 404。
