# Proposal

## Why

`CronManager.vue` 与 `FirewallManager.vue` 全文没有任何 `@media`，且对话框写死像素宽度，手机端必然溢出——与项目"UI 需要支持响应式布局，手机端方便访问"的约定相悖。同时前端存在明显重复：`formatBytes` 7 份、`formatTime` 5 份、`loading + try/catch + ElMessage.error` 模板 13 处，而 `composables/` 目录下只有 `useMobile.js`。

## What Changes

- 为 `CronManager.vue`、`FirewallManager.vue` 补齐移动端适配：表格横向滚动策略、对话框宽度自适应。
- 抽取 `useFormat` composable（字节格式化、时间格式化），替换 7 处 `formatBytes`/`formatSize` 与 5 处 `formatTime` 的重复实现。
- 抽取 `useAsyncData` composable 收敛 loading/error 模式，替换散落的同构加载与错误提示代码。
- 在替换后校验各页面行为不变。

**边界（不做什么）：**

- 不改动任何业务逻辑、API 调用语义或数据结构。
- 不重做 UI 视觉风格，保持现有宝塔式布局。
- 不引入新的 UI 组件库或状态管理库。
- 不做全站视觉重构，只处理上述页面与上述重复点。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

- `cron`：若 spec 已包含页面 UI 需求，修正其移动端可用性/响应式描述；否则不新增需求。
- `firewall`：同上。

<!-- 注意：纯 refactor 部分（抽 composable）不产生 spec 变更；只有页面可观察行为变化才进入 delta。 -->

## Impact

- `client/src/views/CronManager.vue`、`client/src/views/FirewallManager.vue`：样式与响应式。
- `client/src/views/*.vue`（Dashboard/Sync/SystemdManager/Pm2Manager/NginxManager/DirectLinkManager 等）与 `client/src/components/FileBrowser.vue`：替换为共享 composable。
- 新增 `client/src/composables/useFormat.js`、`client/src/composables/useAsyncData.js`。
- 依赖：无新增依赖。
- 风险：批量替换格式化函数时需确认各处保留小数位/单位/时区行为一致，避免显示回归。
