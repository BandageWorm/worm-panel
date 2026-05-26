## 新增需求

### 需求：从 GitHub 部署 Worker

系统应支持通过 PM2 页面输入 GitHub 仓库地址，自动 clone 并使用 miniflare 在本地运行 Worker 项目。

#### 场景：部署 Worker 项目
- **WHEN** 用户在 PM2 页面点击"从 GitHub 部署 Worker"，填写仓库地址、项目名称、入口文件、分支和端口
- **THEN** 系统 clone 仓库、安装依赖、通过 pm2 start miniflare 启动项目，进程出现在 PM2 进程列表中

#### 场景：列出已部署项目
- **WHEN** 已认证用户发送 GET /api/gitworker/projects
- **THEN** 系统返回已部署项目列表（名称、仓库、端口、创建时间、本地路径）

#### 场景：删除 Worker 项目
- **WHEN** 用户在 PM2 页面点击删除 Worker 项目并确认
- **THEN** 系统停止 PM2 进程，删除本地代码目录，移除项目记录
