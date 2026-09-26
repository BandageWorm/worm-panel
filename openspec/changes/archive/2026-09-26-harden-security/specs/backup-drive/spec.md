# Spec Delta

## ADDED Requirements

### Requirement: 备份盘文件名净化与路径逃逸防护

系统在处理备份盘的上传与重命名时 MUST 对用户提供的名称做净化：MUST 去除目录部分仅保留基础名；MUST 拒绝空名、`.`、`..` 以及含路径分隔符的名称。写入前系统 SHALL 校验最终路径仍位于 `data/drive/` 之内，否则 MUST 拒绝操作。

#### Scenario: 上传文件名包含路径穿越

- **WHEN** 上传文件的原始名为 `../escape.txt`
- **THEN** 系统拒绝该上传并返回校验错误，不写入任何文件，也不触发 WebDAV 同步

#### Scenario: 上传文件名包含目录前缀

- **WHEN** 上传文件的原始名为 `a/b.txt`
- **THEN** 系统仅保留 `b.txt` 作为文件名保存到目标目录

#### Scenario: 重命名新名包含路径穿越

- **WHEN** 重命名请求提供的名称为 `../../outside`
- **THEN** 系统拒绝该操作并返回校验错误，文件保持原名

#### Scenario: 重命名新名为空或为点

- **WHEN** 重命名请求提供的名称为空、`.` 或 `..`
- **THEN** 系统拒绝该操作并返回校验错误
