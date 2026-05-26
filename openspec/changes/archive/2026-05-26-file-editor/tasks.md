## 1. 后端 — Service 层新增 readFile / writeFile

- [x] 1.1 在 `src/services/files.js` 中新增 `readFile(filePath)` — 校验文件存在、非目录、大小 < 1MB、UTF-8 解码，返回文件内容字符串
- [x] 1.2 在 `src/services/files.js` 中新增 `writeFile(filePath, content)` — 校验父目录存在、以 UTF-8 写入文件

## 2. 后端 — 新增 API 路由

- [x] 2.1 在 `src/routes/files.js` 中新增 `GET /api/files/read?path=` 路由，调用 readFile 返回 `{ content }`
- [x] 2.2 在 `src/routes/files.js` 中新增 `PUT /api/files/write` 路由，body `{ path, content }`，调用 writeFile 保存

## 3. 前端 — 安装 CodeMirror 6 依赖

- [x] 3.1 在 `client/` 目录安装 `vue-codemirror`, `codemirror`, `@codemirror/lang-javascript`, `@codemirror/lang-html`, `@codemirror/lang-css`, `@codemirror/lang-markdown`, `@codemirror/lang-yaml`, `@codemirror/lang-xml`, `@codemirror/lang-sql`, `@codemirror/theme-one-dark` 依赖

## 4. 前端 — 实现文本编辑器弹窗

- [x] 4.1 在 `client/src/components/FileBrowser.vue` 中定义可编辑文件扩展名白名单及 CodeMirror 语言模式映射表
- [x] 4.2 在文件列表操作列新增"编辑"按钮（仅对匹配白名单的文件显示）
- [x] 4.3 实现编辑器弹窗（el-dialog）：标题显示文件路径、加载时显示 loading、读取成功后渲染 CodeMirror 编辑器、保存按钮调用 write API、成功关闭弹窗并刷新列表
- [x] 4.4 实现文件读取失败/保存失败的错误处理，在弹窗内显示错误提示
