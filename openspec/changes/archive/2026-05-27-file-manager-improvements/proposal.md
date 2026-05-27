## Why

文件管理是日常运维高频操作，当前的文件浏览器缺少排序功能和便捷的路径操作，文本编辑器在移动端使用体验不佳。这些改进能显著提升日常操作效率。

## What Changes

1. **文件列表排序** — 名称、大小、修改时间三列支持点击列头排序（升序/降序切换）
2. **面包屑导航增强** — 支持编辑按钮切换为路径输入框直接输入路径跳转，支持一键复制完整路径
3. **编辑器移动端字号** — CodeMirror 在手机端字号调整为 12px，提升可读性

以上均为纯前端修改，后端 API 无需变更。

## Capabilities

### New Capabilities

无新增 capability，均为现有 `file-browser` 的 UI 增强。

### Modified Capabilities

- `file-browser`: 文件列表 UI 增加排序能力；面包屑增加编辑/复制能力；文本编辑器增加移动端适配

## Impact

- 仅修改 `client/src/components/FileBrowser.vue`
- 不涉及后端 API 变更
- 不涉及新增依赖
