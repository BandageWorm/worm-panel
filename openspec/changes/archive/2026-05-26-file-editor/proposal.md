## Why

当前文件管理模块仅支持浏览、上传、下载、删除操作，无法直接查看或编辑服务器上的文本文件（如配置文件、脚本、代码等）。用户需要切换到其他工具才能完成简单的文本修改，效率低下。

## What Changes

- 文件管理模块新增文本文件读取 API，支持以 UTF-8 读取文件内容
- 文件管理模块新增文本文件保存 API，支持以 UTF-8 写入文件内容
- 文件浏览页面新增文本编辑器弹窗，集成 CodeMirror 6 实现语法高亮
- 文件列表的操作列新增"编辑"按钮，对可编辑的文本文件显示

## Capabilities

### New Capabilities

- 无新增能力，此变更扩展已有 `file-browser` 能力

### Modified Capabilities

- `file-browser`: 增加文本文件读取、编辑保存的 API 和 UI 支持

## Impact

- **后端**: `src/services/files.js` 新增 `readFile()` / `writeFile()` 方法；`src/routes/files.js` 新增 `GET /api/files/read` 和 `PUT /api/files/write` 路由
- **前端**: `client/src/components/FileBrowser.vue` 新增编辑弹窗组件；新增 CodeMirror 6 相关依赖
- **依赖新增**: `vue-codemirror`, `codemirror`, `@codemirror/lang-*` 等语言包
