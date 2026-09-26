# Spec Delta

## ADDED Requirements

### Requirement: 上传文件名净化与路径逃逸防护

系统处理文件上传时 MUST 对上传文件名做净化：MUST 去除其中的目录部分，仅保留基础文件名；MUST 拒绝空文件名、`.`、`..` 以及净化后为空的名字。写入前系统 SHALL 校验最终绝对路径仍位于目标目录之内，否则 MUST 拒绝该上传。

#### Scenario: 文件名包含路径穿越片段

- **WHEN** 上传请求携带的文件名为 `../../etc/passwd` 或 `..%2F..%2Fetc%2Fpasswd`
- **THEN** 系统拒绝该上传并返回校验错误，不写入任何文件

#### Scenario: 文件名包含目录前缀

- **WHEN** 上传请求携带的文件名为 `sub/dir/a.txt`
- **THEN** 系统仅保留 `a.txt` 作为文件名保存到目标目录

#### Scenario: 文件名为空或为点

- **WHEN** 上传请求携带的文件名为空、`.` 或 `..`
- **THEN** 系统拒绝该上传并返回校验错误

#### Scenario: 目标目录不存在

- **WHEN** 上传请求指定的目标目录不存在
- **THEN** 系统返回错误，不创建文件
