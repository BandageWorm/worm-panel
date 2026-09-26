# Spec Delta

## ADDED Requirements

### Requirement: crontab 写入不经过 shell 解释

系统在写入 crontab 时 MUST NOT 将任务内容拼接进 shell 命令行执行。写入 SHALL 通过"将完整 crontab 内容写入临时文件，再交由 crontab 程序从该文件读取"的方式完成，确保任务命令中的 shell 元字符（反引号、`$()`、`;`、换行等）在写入阶段不被解释或执行。

#### Scenario: 任务命令包含 shell 元字符

- **WHEN** 用户创建或编辑的任务命令包含 `$(...)`、反引号或其它 shell 元字符
- **THEN** 系统将其作为普通文本写入 crontab，写入阶段不执行任何子命令

#### Scenario: 写入失败时保持原有 crontab

- **WHEN** 写入临时文件或导入 crontab 的过程中发生错误
- **THEN** 系统返回错误信息，且原有 crontab 内容保持不变

#### Scenario: 写入后 crontab 内容正确

- **WHEN** 写入操作成功完成
- **THEN** crontab 中的任务行与用户提交的命令逐字一致（除去面板标识注释行）
