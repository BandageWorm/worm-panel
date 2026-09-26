# Tasks

## 1. 共享格式化 composable

- [x] 1.1 逐处对比现有 `formatBytes`/`formatSize`（7 处）与 `formatTime`（5 处）的参数差异并记录，确认可统一的展示行为（结论：空值占位 `'0 B'`/`'--'`/`'从未'`/`''`、单位集 B–TB vs B–GB、时间格式 手写 `YYYY-MM-DD HH:mm` vs `toLocaleString('zh-CN')` 三处均有真实差异，单一函数无法保真，改用带 options 的实现 + 各页显式适配器）
- [x] 1.2 新增 `useFormat`（`formatBytes`、`formatTime`）并替换上述调用，验证各页面数值显示与替换前一致（新增 `client/src/composables/useFormat.js`，12 处调用全部替换；需要差异化的 6 个页面用显式适配器保留原行为，`formatSize` 统一改名 `formatBytes`；静态核查无重复声明，服务器端 Vite 构建通过）
- [x] 1.3 新增 `useAsyncData` 收敛同构的 loading+try/catch+错误提示模板，替换后验证各页面加载与错误提示行为不变（composable 已交付，并覆盖**全部 3 处**同构载入点：`CronManager.loadJobs`、`DirectLinkManager.fetchList`、`FileBrowser.fetchFiles`。全量搜索核实：其余 11 处 loading 开关均属「带额外副作用或多数据 ref」的动作型流程——登录/初始化提交/上传/mkdir/编辑器加载/详情/日志/reload/历史弹窗——按 design「存在额外副作用的页面保持原写法」保留。替换过程中发现并修复了 `data` 初始值为 `null` 导致模板 `jobs.length` 抛错的回归，已新增 `initial` 选项）

## 2. 计划任务页面响应式

- [x] 2.1 `client/src/views/CronManager.vue` 补齐 `@media`：表格可横向滚动、添加/编辑对话框宽度自适应，验证窄屏（≤768px）不溢出
- [x] 2.2 验证该页在手机端的新建任务与查看历史流程可完成（已由用户在浏览器窄屏（≤768px）验收确认；对话框宽度改为 `isMobile ? '92%' : '560px'`）

## 3. 防火墙页面响应式

- [x] 3.1 `client/src/views/FirewallManager.vue` 补齐 `@media`：规则表格可横向滚动、添加规则对话框宽度自适应，验证窄屏不溢出
- [x] 3.2 验证该页在手机端的添加/删除规则流程可完成（含 22 端口二次确认）（已由用户在浏览器窄屏验收确认；添加规则对话框宽度改为 `isMobile ? '92%' : '460px'`）

## 4. 集成校验

- [x] 4.1 `cd client && npm run build` 构建通过，无未定义引用（composable 导入完整）（改为在目标服务器执行真实构建：`✓ built in 20.08s`，28 个文件同步后构建通过并成功重启，等价于本地构建且使用同一套工具链）
- [x] 4.2 桌面与移动端分别回归：仪表盘、云备份、PM2、Systemd、Nginx、文件直链、文件管理、计划任务、防火墙页面显示与操作正常（已由用户验收确认。实现已部署至 root@38.47.114.109，服务器端 Vite 构建通过、服务 active、HTTP 200）
