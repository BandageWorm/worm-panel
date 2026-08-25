## Purpose

在面板中提供 systemd 服务的可视化管理能力，支持查看服务列表、执行启停操作、管理开机自启及查看服务日志。

## ADDED Requirements

### Requirement: 服务列表展示

系统 SHALL 提供 API 返回所有 systemd service 单元列表，包含服务名、运行状态（active/inactive/failed）、子状态（running/dead/exited 等）、开机自启状态（enabled/disabled）和描述信息。列表 SHALL 按运行状态排序：active 排在最前，failed 其次，inactive 排在最后；同状态内按服务名字母序排列。

#### Scenario: 获取完整服务列表
- **WHEN** 用户请求服务列表 API
- **THEN** 系统返回所有 loaded 的 service 单元，每个包含 name、active_state、sub_state、enabled、description 字段，且 active 状态的服务排在前面

#### Scenario: 前端搜索过滤
- **WHEN** 用户在搜索框输入关键字
- **THEN** 前端实时过滤列表，仅显示服务名或描述中包含关键字的条目

#### Scenario: 前端状态筛选
- **WHEN** 用户选择状态筛选条件（如仅显示 running）
- **THEN** 前端仅展示符合所选状态的服务

### Requirement: 服务启停操作

系统 SHALL 提供 API 对指定服务执行 start、stop、restart、reload 操作。操作成功 SHALL 返回成功状态，操作失败 SHALL 返回错误信息。

#### Scenario: 重启服务
- **WHEN** 用户对一个 active 状态的服务执行 restart
- **THEN** 系统执行 `systemctl restart <service>` 并返回操作结果

#### Scenario: 启动已停止的服务
- **WHEN** 用户对一个 inactive 状态的服务执行 start
- **THEN** 系统执行 `systemctl start <service>` 并返回成功

#### Scenario: 停止运行中的服务
- **WHEN** 用户对一个 active 状态的服务执行 stop
- **THEN** 系统执行 `systemctl stop <service>` 并返回成功

#### Scenario: 操作失败
- **WHEN** systemctl 命令执行失败（如服务不存在或权限不足）
- **THEN** 系统返回包含 stderr 内容的错误信息

### Requirement: 开机自启管理

系统 SHALL 提供 API 对指定服务执行 enable 和 disable 操作，切换开机自启状态。

#### Scenario: 启用开机自启
- **WHEN** 用户对一个 disabled 的服务执行 enable
- **THEN** 系统执行 `systemctl enable <service>` 并返回成功

#### Scenario: 禁用开机自启
- **WHEN** 用户对一个 enabled 的服务执行 disable
- **THEN** 系统执行 `systemctl disable <service>` 并返回成功

### Requirement: 服务详情查看

系统 SHALL 提供 API 返回指定服务的详细状态信息，包含：主 PID、内存占用、运行时长、Unit 文件路径、服务描述、启动时间。

#### Scenario: 查看运行中服务详情
- **WHEN** 用户请求某个 active 服务的详情
- **THEN** 系统返回该服务的 PID、MemoryCurrent、ActiveEnterTimestamp、FragmentPath、Description 等字段

#### Scenario: 查看已停止服务详情
- **WHEN** 用户请求某个 inactive 服务的详情
- **THEN** 系统返回该服务的基本信息，PID 为空，内存为 0

### Requirement: 服务日志查看

系统 SHALL 提供 API 返回指定服务的最近日志，默认返回最近 100 行。

#### Scenario: 查看服务日志
- **WHEN** 用户请求某个服务的日志
- **THEN** 系统返回 journalctl 最近 100 行日志内容

#### Scenario: 指定日志行数
- **WHEN** 用户请求日志并指定 lines 参数
- **THEN** 系统返回对应行数的日志内容

### Requirement: 面板自身服务保护

系统 SHALL 保护 worm-panel.service 不被停止或禁用。允许重启但 SHALL 要求前端二次确认。

#### Scenario: 尝试停止面板服务
- **WHEN** 用户对 worm-panel.service 执行 stop
- **THEN** 系统拒绝操作并返回错误提示「面板自身服务不允许停止」

#### Scenario: 尝试禁用面板开机自启
- **WHEN** 用户对 worm-panel.service 执行 disable
- **THEN** 系统拒绝操作并返回错误提示「面板自身服务不允许禁用」

#### Scenario: 重启面板服务
- **WHEN** 用户对 worm-panel.service 执行 restart 且前端已通过二次确认
- **THEN** 系统执行重启操作（连接将断开）

### Requirement: 权限处理

系统 SHALL 在执行 systemctl 命令时自动添加 sudo 前缀。如遇权限错误 SHALL 在响应中明确提示。

#### Scenario: sudo 执行命令
- **WHEN** 系统执行任何 systemctl 写操作（start/stop/restart/reload/enable/disable）
- **THEN** 命令以 `sudo systemctl` 形式执行

#### Scenario: 权限不足
- **WHEN** sudo 执行失败（如 sudoers 未配置）
- **THEN** 系统返回包含权限错误说明的响应
