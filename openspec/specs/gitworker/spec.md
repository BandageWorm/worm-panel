## Purpose

支持从 GitHub 仓库部署 Worker 项目并在 VPS 本地运行：面板负责 clone 仓库、安装依赖，并通过 PM2 托管进程。

## Requirements

### Requirement: 从 GitHub 部署 Worker

系统 SHALL 支持在 PM2 页面输入 GitHub 仓库地址，自动 clone 并使用 miniflare 在本地运行 Worker 项目。

#### Scenario: 部署 Worker 项目
- **WHEN** 用户在 PM2 页面点击"从 GitHub 部署 Worker"，填写仓库地址、项目名称、入口文件、分支和端口并提交
- **THEN** 系统 clone 仓库、安装依赖、通过 pm2 start miniflare 启动项目，进程出现在 PM2 进程列表中

#### Scenario: 列出已部署项目
- **WHEN** 已认证用户发送 GET /api/gitworker/projects
- **THEN** 系统返回已部署项目列表（名称、仓库、端口、创建时间、本地路径、当前运行状态）

#### Scenario: 删除 Worker 项目
- **WHEN** 用户在 PM2 页面点击删除 Worker 项目并确认
- **THEN** 系统停止 PM2 进程，删除本地代码目录，移除项目记录

### Requirement: 部署表单校验与耗时反馈

系统 SHALL 在提交前校验部署表单，并在耗时较长的部署过程中给出明确状态。

#### Scenario: 表单校验
- **WHEN** 用户提交的仓库地址格式不合法、项目名包含非法字符或端口不在 1024-65535 之间
- **THEN** 系统在提交前给出可读的校验提示，不发起部署请求

#### Scenario: 部署耗时较长
- **WHEN** 部署过程持续数十秒（clone、安装依赖、启动进程）
- **THEN** 页面持续显示部署阶段与已用时间，并禁用重复提交

#### Scenario: 请求超时
- **WHEN** 部署请求超过前端等待上限（约 150 秒）
- **THEN** 页面提示可能仍在后台进行，并引导用户刷新列表确认结果，而不是静默失败

#### Scenario: 部署失败
- **WHEN** clone 失败、依赖安装异常或进程启动失败
- **THEN** 页面展示失败原因，且系统不留下不完整的项目记录

### Requirement: 项目运行状态关联

系统 SHALL 把已部署 Worker 项目与其 PM2 进程状态关联展示。

#### Scenario: 正常运行的项目
- **WHEN** 项目对应的 PM2 进程处于 online 状态
- **THEN** 页面展示为"运行中"，并可查看进程 ID 与重启次数

#### Scenario: 进程已停止或异常
- **WHEN** 项目对应的 PM2 进程处于 stopped 或 errored 状态
- **THEN** 页面展示对应状态，便于与 PM2 进程列表交叉排查

#### Scenario: 进程不存在
- **WHEN** 项目记录存在但 PM2 中已无对应进程（例如被手动删除）
- **THEN** 页面展示为"未运行"，并提供删除该记录的入口

#### Scenario: PM2 不可用
- **WHEN** 查询 PM2 状态失败
- **THEN** 项目信息仍可展示，运行状态标记为"未知"，页面不整体报错

#### Scenario: 进程列表标识
- **WHEN** PM2 进程列表中出现由 Worker 部署创建的项目
- **THEN** 该进程行带有 Worker 标识，便于与普通 PM2 进程区分
