### Requirement: 查看计划任务列表
系统 SHALL 提供 API 返回所有 crontab 任务，区分面板管理的任务和用户手动添加的任务。

#### Scenario: 获取任务列表
- **WHEN** 用户请求 `GET /api/cron/jobs`
- **THEN** 返回任务数组，面板管理的任务包含 `{ id, name, schedule, command, enabled, managed: true }`，非面板任务包含 `{ schedule, command, managed: false }`

#### Scenario: 无任务时
- **WHEN** 用户请求 `GET /api/cron/jobs` 且 crontab 为空
- **THEN** 返回空数组 `[]`

### Requirement: 创建计划任务
系统 SHALL 提供 API 创建新的计划任务，写入 crontab 并附带面板标识注释。

#### Scenario: 创建定时任务
- **WHEN** 用户请求 `POST /api/cron/jobs` 传入 `{ name: "清理日志", schedule: "0 3 * * *", command: "find /tmp -mtime +7 -delete" }`
- **THEN** 在 crontab 中追加标识注释行和任务行，返回创建的任务对象（含生成的 id）

#### Scenario: 任务名称重复
- **WHEN** 用户创建的任务名称已存在
- **THEN** 返回 400 错误 `{ error: "任务名称已存在" }`

### Requirement: 编辑计划任务
系统 SHALL 提供 API 编辑面板管理的计划任务（名称、周期、命令）。

#### Scenario: 修改任务周期
- **WHEN** 用户请求 `PUT /api/cron/jobs/:id` 传入 `{ schedule: "0 4 * * *" }`
- **THEN** 更新 crontab 中对应行，返回成功

#### Scenario: 编辑非面板任务被拒绝
- **WHEN** 用户请求编辑一个非面板管理的任务
- **THEN** 返回 403 错误 `{ error: "无法编辑非面板管理的任务" }`

### Requirement: 删除计划任务
系统 SHALL 提供 API 删除面板管理的计划任务。

#### Scenario: 删除任务
- **WHEN** 用户请求 `DELETE /api/cron/jobs/:id`
- **THEN** 从 crontab 中移除标识注释行和任务行，清理对应的历史记录文件，返回成功

#### Scenario: 删除不存在的任务
- **WHEN** 用户请求删除一个不存在的任务 id
- **THEN** 返回 404 错误

### Requirement: 启用/禁用计划任务
系统 SHALL 支持禁用计划任务（注释掉 cron 行）而不删除任务定义。

#### Scenario: 禁用任务
- **WHEN** 用户请求 `PUT /api/cron/jobs/:id` 传入 `{ enabled: false }`
- **THEN** crontab 中对应任务行前加 `#` 注释，标识注释行保留

#### Scenario: 启用任务
- **WHEN** 用户请求 `PUT /api/cron/jobs/:id` 传入 `{ enabled: true }`
- **THEN** 移除 crontab 中对应任务行前的 `#` 注释

### Requirement: 立即执行任务
系统 SHALL 提供 API 手动触发一次计划任务执行，并记录结果。

#### Scenario: 执行成功
- **WHEN** 用户请求 `POST /api/cron/jobs/:id/run`
- **THEN** 执行任务命令，等待完成，将结果（exitCode、stdout、stderr、duration）写入执行历史，返回执行结果

#### Scenario: 执行超时
- **WHEN** 任务执行超过 60 秒
- **THEN** 强制终止进程，记录 `exitCode: -1`，标记超时

### Requirement: 查看执行历史
系统 SHALL 提供 API 返回指定任务的执行历史记录。

#### Scenario: 获取历史
- **WHEN** 用户请求 `GET /api/cron/jobs/:id/history`
- **THEN** 返回该任务最近 50 条执行记录，按时间倒序，每条包含 `{ time, exitCode, stdout, stderr, duration }`

#### Scenario: 无历史记录
- **WHEN** 任务从未执行过
- **THEN** 返回空数组 `[]`

### Requirement: 执行历史存储与清理
系统 SHALL 以 JSONL 文件存储每个任务的执行历史，每个任务保留最近 50 条记录。

#### Scenario: 历史记录滚动
- **WHEN** 某任务执行历史超过 50 条
- **THEN** 自动截断，只保留最近 50 条

#### Scenario: 存储位置
- **WHEN** 执行记录写入时
- **THEN** 存储至 `data/cron-history/<id>.jsonl`

### Requirement: Crontab 并发写入保护
系统 SHALL 对 crontab 写操作加互斥锁，防止并发修改导致数据丢失。

#### Scenario: 并发写入
- **WHEN** 两个请求同时尝试修改 crontab
- **THEN** 第二个请求 MUST 等待第一个完成后再执行，不会丢失数据

### Requirement: 计划任务管理页面
前端 SHALL 提供计划任务管理页面，展示任务列表、添加/编辑对话框、执行历史。

#### Scenario: 页面展示
- **WHEN** 用户导航到计划任务页面
- **THEN** 展示任务表格（状态、名称、周期描述、命令、操作按钮）和添加按钮

#### Scenario: 添加/编辑对话框
- **WHEN** 用户点击添加或编辑按钮
- **THEN** 展示对话框，包含任务名称、周期选择器（快捷模式/高级 cron 表达式）、命令输入框、cron 表达式预览

#### Scenario: 周期选择器快捷模式
- **WHEN** 用户选择快捷模式
- **THEN** 提供「每N分钟」「每小时」「每天」「每周」「每月」预设选项和时间选择

#### Scenario: 查看执行历史
- **WHEN** 用户点击任务的历史按钮
- **THEN** 展示该任务的执行记录列表（时间、状态、耗时），可展开查看 stdout/stderr

#### Scenario: 非面板任务只读展示
- **WHEN** 任务列表中存在非面板管理的任务
- **THEN** 这些任务展示为只读行，编辑/删除/执行按钮禁用，标记为「系统任务」

### Requirement: 侧边栏导航入口
前端 SHALL 在侧边栏添加计划任务菜单项，位于「SSL 证书」之后、「PM2」之前。

#### Scenario: 菜单位置
- **WHEN** 用户查看侧边栏
- **THEN** 计划任务菜单项位于 SSL 证书和 PM2 之间
