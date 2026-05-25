## 1. 后端 Settings API

- [x] 1.1 创建 `src/routes/settings.js`，实现 GET /api/settings（返回 port、mode、domain）
- [x] 1.2 实现 PUT /api/settings 处理器（更新 port、mode、domain；处理 standalone↔proxy 切换）
- [x] 1.3 PUT /api/settings 支持密码修改（传入 password 时 bcrypt 哈希更新）
- [x] 1.4 实现 POST /api/settings/restart 处理器（process.exit 重启）
- [x] 1.5 在 `src/index.js` 中注册 settings 路由（放在 auth 中间件之后，SPA 回退之前）

## 2. 前端设置页面

- [x] 2.1 创建 `client/src/views/Settings.vue`，包含基本设置卡片（端口、模式、域名）
- [x] 2.2 添加安全设置卡片（密码修改 + 确认）
- [x] 2.3 添加重启按钮 + 确认对话框
- [x] 2.4 更新 `client/src/router/index.js`，将 /settings 指向 Settings.vue
- [x] 2.5 在 client/ 目录执行 `npm run build`，重新生成静态资源

## 3. 验证 [x]

- [x] 3.1 启动面板并访问 /settings，确认当前值正确显示
- [x] 3.2 修改端口并保存，确认 config.json 已更新
- [x] 3.3 切换到 proxy 模式并填写域名，保存，确认 nginx 配置已生成
- [x] 3.4 切换回 standalone 模式，保存，确认 config.json 已更新
- [x] 3.5 修改密码，保存，确认用新密码可以登录
- [x] 3.6 点击重启按钮，确认面板重启后可以正常访问
