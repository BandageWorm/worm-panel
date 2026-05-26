## 已移除需求

**原因**: Workers 能力被移除。Worker 项目改为通过 miniflare + PM2 在 VPS 本地运行，不再需要面板中的项目管理功能。PM2 模块可直接管理 miniflare 进程。

### ~~需求：Workers 项目管理~~

~~系统应管理 Cloudflare Workers 项目列表，元数据存储在 config.json 中。~~

~~#### 场景：获取项目列表~~
~~- **当** 已认证用户发送 GET /api/workers/projects~~
~~- **则** 系统返回项目列表（名称、仓库、分支、最近部署时间）~~

~~#### 场景：添加项目~~
~~- **当** 已认证用户发送 POST /api/workers/projects，携带名称、仓库 URL、分支~~
~~- **则** 系统执行 git clone，将项目信息保存到 config.json~~

~~#### 场景：删除项目~~
~~- **当** 已认证用户发送 DELETE /api/workers/projects/:name~~
~~- **则** 系统删除项目元数据和本地文件~~

### ~~需求：Workers 部署~~

~~系统应支持通过 git pull + wrangler deploy 部署 Workers。~~

~~#### 场景：触发部署~~
~~- **当** 已认证用户发送 POST /api/workers/deploy/:name~~
~~- **则** 系统进入项目目录执行 git pull，然后运行 npx wrangler deploy，捕获并返回部署日志~~

~~#### 场景：查看部署日志~~
~~- **当** 已认证用户发送 GET /api/workers/deploy/:name/log~~
~~- **则** 系统返回上次部署的日志内容~~

### ~~需求：Wrangler 环境检测~~

~~系统应检测 wrangler 命令行工具是否可用。~~

~~#### 场景：检测 Wrangler 状态~~
~~- **当** 已认证用户发送 GET /api/workers/status~~
~~- **则** 系统检查 npx wrangler 是否可用并返回状态~~

### ~~需求：Workers 管理页面 UI~~

~~系统应在 /#/workers 提供 Workers 部署管理页面。~~

~~#### 场景：查看项目列表~~
~~- **当** 已认证用户导航到 /workers~~
~~- **则** 页面显示项目列表（名称、仓库、最近部署时间）和 wrangler 环境状态~~

~~#### 场景：添加项目~~
~~- **当** 用户填写项目名称、仓库 URL、分支并提交~~
~~- **则** 系统添加项目并刷新列表~~

~~#### 场景：部署项目~~
~~- **当** 用户点击项目旁的部署按钮~~
~~- **则** 系统触发部署，页面实时显示部署日志~~

~~#### 场景：删除项目~~
~~- **当** 用户点击删除并确认~~
~~- **则** 系统删除项目~~
