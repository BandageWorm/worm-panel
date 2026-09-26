# Spec Delta

## MODIFIED Requirements

### Requirement: 编辑计划任务

系统 SHALL 提供 API 编辑面板管理的计划任务（名称、周期、命令）。

#### Scenario: 修改任务周期

- **WHEN** 用户请求 `PUT /api/cron/jobs/:id` 传入 `{ schedule: "0 4 * * *" }`
- **THEN** 更新 crontab 中对应行，返回成功

#### Scenario: 编辑非面板任务被拒绝

- **WHEN** 用户请求 `PUT /api/cron/jobs/:id`，而该 id 不对应任何面板管理的任务（非面板任务不分配 id，无法被寻址）
- **THEN** 返回 404 错误 `{ error: "任务不存在" }`
