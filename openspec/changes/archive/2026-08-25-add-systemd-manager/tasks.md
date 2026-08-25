## 1. 后端 Service 层

- [x] 1.1 创建 `src/services/systemd.js`，实现 `listServices()` 函数：调用 `systemctl list-units --type=service --all --output=json`，解析输出返回服务列表（name、active_state、sub_state、enabled、description），按 active 优先排序。验证：WSL2 中 `node -e "require('./src/services/systemd').listServices().then(console.log)"` 输出服务数组。

- [x] 1.2 实现 `getServiceDetail(name)` 函数：调用 `systemctl show <name> --no-pager`，解析输出返回 PID、MemoryCurrent、ActiveEnterTimestamp、FragmentPath、Description 等字段。验证：传入 `ssh.service` 返回包含 MainPID 字段的对象。

- [x] 1.3 实现 `getServiceLogs(name, lines)` 函数：调用 `journalctl -u <name> --no-pager -n <lines> --output=short`，返回日志文本。验证：传入已有服务名返回非空字符串。

- [x] 1.4 实现写操作函数 `controlService(name, action)`：支持 start/stop/restart/reload/enable/disable，使用 `sudo systemctl <action> <name>`。包含服务名正则校验（`/^[a-zA-Z0-9@._-]+$/`）和 worm-panel.service 保护逻辑（拒绝 stop 和 disable）。验证：传入非法服务名时抛出校验错误；传入 worm-panel.service + stop 时抛出保护错误。

## 2. 后端路由层

- [x] 2.1 创建 `src/routes/systemd.js`，实现所有 API 端点：GET /services（列表）、GET /services/:name（详情）、GET /services/:name/logs（日志，query 参数 lines 默认 100）、POST /services/:name/start|stop|restart|reload|enable|disable。每个端点包含 try/catch 错误处理和 logger 调用。验证：文件语法无误，路由结构完整。

- [x] 2.2 在 `src/index.js` 中注册路由：`app.use('/api/systemd', authMiddleware, require('./routes/systemd'))`。验证：WSL2 中 `node -e "require('./src/index')"` 不报错。

## 3. 前端页面

- [x] 3.1 创建 `client/src/views/SystemdManager.vue`，实现服务列表展示：表格包含服务名、状态标签（绿色 running / 红色 failed / 灰色 dead）、开机自启状态、操作按钮。支持搜索框实时过滤和状态下拉筛选。验证：前端构建成功，页面可渲染服务列表。

- [x] 3.2 实现服务操作功能：启动/停止/重启/重载按钮，点击执行 API 调用并刷新列表。enable/disable 通过开关切换。worm-panel.service 的停止和禁用按钮禁用，重启按钮触发 ElMessageBox.confirm 二次确认。验证：点击重启触发确认弹窗，确认后调用 API。

- [x] 3.3 实现服务详情和日志查看：点击服务名展开详情区域或抽屉，显示 PID、内存、启动时间、Unit 文件路径。提供「查看日志」按钮，点击弹出对话框显示最近 100 行日志（等宽字体预格式化）。验证：点击服务名可看到详情信息，点击日志按钮可看到日志内容。

## 4. 前端集成

- [x] 4.1 在 `client/src/router/index.js` 注册路由 `{ path: 'systemd', component: () => import('../views/SystemdManager.vue'), meta: { title: 'Systemd 管理' } }`。验证：浏览器访问 `/#/systemd` 可加载页面。

- [x] 4.2 在 `client/src/layouts/MainLayout.vue` 侧边栏添加菜单项（放在 PM2 之后）：图标使用 `Setting`，标签为「Systemd」，路由为 `/systemd`。验证：侧边栏显示 Systemd 入口且点击可跳转。

## 5. 端到端验证

- [x] 5.1 在 WSL2 中启动面板 `node app.js`，浏览器访问 Systemd 管理页面，确认：列表正常加载且 running 排前面、搜索过滤正常、状态筛选正常、重启某个服务成功、查看日志正常显示、worm-panel.service 停止按钮被禁用。
