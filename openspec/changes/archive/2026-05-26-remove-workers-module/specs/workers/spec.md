## 已移除需求

### 需求：Workers 项目管理

**原因**: Workers 能力被移除。Worker 项目改为通过 miniflare + PM2 在 VPS 本地运行，不再需要面板中的项目管理功能。PM2 模块可直接管理 miniflare 进程。

**迁移**: 通过 SSH 在服务器上执行 `pm2 start miniflare -- <worker-entry>` 手动启动 Worker。使用面板的 PM2 页面查看进程状态。

### 需求：Workers 部署

**原因**: 不再需要 wrangler 部署到 Cloudflare 的流程。

**迁移**: 改用 miniflare 本地运行 Worker 项目。项目代码通过 git clone 手动部署到服务器，不再通过面板管理。

### 需求：Wrangler 环境检测

**原因**: wrangler CLI 不再需要，安装脚本中已移除。

**迁移**: 无需替代。如需本地运行 Worker，安装 miniflare。

### 需求：Workers 管理页面 UI

**原因**: Workers 页面和菜单项已被删除。

**迁移**: 使用 PM2 页面管理 miniflare 进程。
