# Spec Delta

## MODIFIED Requirements

### Requirement: 备份历史记录

系统 SHALL 记录并展示备份操作的历史，历史记录保留上限为 20 条。

#### Scenario: 查询历史记录

- **WHEN** 已认证用户发送 GET /api/sync/history
- **THEN** 系统返回备份历史列表（时间、状态、文件数、大小）

#### Scenario: 历史记录上限

- **WHEN** 备份历史记录超过 20 条
- **THEN** 系统自动删除最旧的记录，仅保留最近 20 条
