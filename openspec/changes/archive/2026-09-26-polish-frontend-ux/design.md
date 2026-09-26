# Design

## Context

动机见 `proposal.md` 的 Why。影响方案的现状约束：

- 前端为 Vue 3 + Element Plus，页面位于 `client/src/views/`，通用组件在 `client/src/components/`。
- `client/src/composables/` 目前只有 `useMobile.js`（提供 `isMobile`），说明 composable 模式已是项目既有做法。
- 已有 13 个页面/组件采用了 `@media`，`CronManager.vue`、`FirewallManager.vue` 缺失。
- 重复实现：`formatBytes`/`formatSize` 7 处、`formatTime` 5 处、`loading + try/catch + ElMessage.error` 模板约 13 处。

## Goals / Non-Goals

**Goals:**

- `CronManager`、`FirewallManager` 在手机端可用（表格不撑破、对话框不溢出）。
- 统一字节/时间格式化为共享 composable，消除 12 处重复。
- 收敛加载/错误提示模板，减少后续页面的样板代码。

**Non-Goals:**

- 不改动业务逻辑、API 语义、数据模型。
- 不做视觉重构，保持宝塔式布局与既有配色。
- 不引入状态管理库或新 UI 组件库。
- 不改动已有 `@media` 且表现正常的页面布局。

## Decisions

### 1. 响应式采用"表格横向滚动 + 对话框自适应"

- 表格：容器 `overflow-x: auto`，避免列被压缩到不可读；不改成卡片式列表（改动面过大且与其它页面不一致）。
- 对话框：固定 `width="560px"`/`460px` 改为响应式宽度（如 `width="min(90vw, 560px)"` 或 `:width` 绑定 `isMobile`）。
- 备选：为两页新增卡片式移动端布局。放弃原因：与其它 13 个页面风格不一致，收益不足以支撑改动量。

### 2. 抽 `useFormat` composable

导出 `formatBytes(n)` 与 `formatTime(ts)`，替换全部重复实现。

- 关键约束：必须保持各处原有的显示行为一致——小数位、单位阈值（1024 进制）、时间是否本地化/相对时间。替换前先逐处对比参数差异，以现有实现中最通用的行为为准。
- 备选：只抽 `formatBytes`，时间格式化因各处差异保留。需在实现时先核对差异，若差异确实存在则采用此备选。

### 3. 抽 `useAsyncData` composable 收敛加载/错误模板

封装 `{ loading, data, error, load }`，`load` 内部统一 try/catch/finally 与错误消息。

- 仅替换语义完全一致的同构调用；存在额外副作用的页面保持原写法，避免为了统一而引入行为差异。

## Risks / Trade-offs

- [替换格式化函数导致显示回归（小数位/单位/时区变化）] → 逐处对比参数，必要时保留差异或让 composable 支持参数。
- [`useAsyncData` 过度抽象，某些页面 loading 语义不止一种] → 只替换同构调用，不强行统一。
- [Element Plus `el-dialog` 在窄屏的默认行为差异] → 明确使用 CSS 宽度或 `isMobile` 绑定，并在真机/窄屏验证。

## Migration Plan

- 纯前端改动，构建后由后端托管；`cd client && npm run build` 生效。
- 回滚：还原 `client/src` 相关文件并重新构建。
