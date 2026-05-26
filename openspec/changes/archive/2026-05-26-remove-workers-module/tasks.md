## 1. 后端清理

- [x] 1.1 删除 `src/routes/workers.js`
- [x] 1.2 删除 `src/services/workers.js`
- [x] 1.3 在 `src/index.js` 中移除 `app.use('/api/workers', ...)` 路由注册
- [x] 1.4 在 `src/services/config.js` 中移除 `cloudflareApiToken` 默认值和 `workers` 相关读写逻辑

## 2. 前端清理

- [x] 2.1 删除 `client/src/views/WorkersManager.vue`
- [x] 2.2 在 `client/src/router/index.js` 中移除 `/workers` 路由
- [x] 2.3 在 `client/src/layouts/MainLayout.vue` 中移除 Workers 菜单项

## 3. 部署脚本清理

- [x] 3.1 在 `scripts/install.sh` 中移除 wrangler 全局安装逻辑，改为 `npm install -g miniflare`
- [x] 3.2 在 `scripts/install.sh` 和 `scripts/deploy.sh` 中移除 `data/workers/` 和 `data/logs/workers/` 目录创建

## 4. 验证

- [ ] 4.1 启动面板确认无 Workers 相关报错
- [ ] 4.2 前端确认侧边栏无 Workers 菜单、访问 /workers 返回 404
- [ ] 4.3 确认 config.json 中 Workers 相关配置不再被写入

## 5. 附加

- [x] 5.1 在 `scripts/install.sh` 完成输出中增加 miniflare + PM2 部署说明
