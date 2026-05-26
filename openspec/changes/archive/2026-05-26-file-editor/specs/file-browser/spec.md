## ADDED Requirements

### Requirement: 读取文件内容

系统应支持读取文本文件的内容并以 UTF-8 返回。

#### Scenario: 成功读取文本文件
- **WHEN** 已认证用户发送 GET /api/files/read，path 参数指向一个存在的文本文件
- **THEN** 系统返回 200，JSON body 包含 `{ content: "<文件内容>" }`

#### Scenario: 文件不存在
- **WHEN** path 指向不存在的文件
- **THEN** 系统返回 404 错误

#### Scenario: path 指向目录
- **WHEN** path 指向一个目录
- **THEN** 系统返回 400 错误，提示"无法读取目录"

#### Scenario: 文件超过大小限制
- **WHEN** 文件大小超过 1MB
- **THEN** 系统返回 413 错误，提示"文件过大无法编辑"

#### Scenario: 非 UTF-8 编码文件
- **WHEN** 文件无法以 UTF-8 解码
- **THEN** 系统返回 400 错误，提示"不支持的文件编码"

#### Scenario: 路径穿越防护
- **WHEN** path 参数包含 `..` 或其他路径穿越字符
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 保存文件内容

系统应支持以 UTF-8 编码保存内容到指定文件。

#### Scenario: 成功保存文件
- **WHEN** 已认证用户发送 PUT /api/files/write，body 为 `{ path: "<文件路径>", content: "<新内容>" }`
- **THEN** 系统将内容以 UTF-8 写入文件，返回 200 成功

#### Scenario: 父目录不存在
- **WHEN** path 指向的父目录不存在
- **THEN** 系统返回 400 错误

#### Scenario: path 指向目录
- **WHEN** path 指向一个目录
- **THEN** 系统返回 400 错误，提示"无法写入目录"

#### Scenario: 路径穿越防护
- **WHEN** path 参数包含 `..` 或其他路径穿越字符
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 文件编辑页面 UI

系统应在文件管理页面提供文本编辑器弹窗。

#### Scenario: 显示编辑按钮
- **WHEN** 文件列表中的文件扩展名匹配可编辑类型白名单
- **THEN** 该文件行的操作列显示"编辑"按钮

#### Scenario: 隐藏编辑按钮
- **WHEN** 文件扩展名不在白名单中，或该项是目录
- **THEN** 操作列不显示"编辑"按钮

#### Scenario: 打开编辑弹窗
- **WHEN** 用户点击"编辑"按钮
- **THEN** 弹出编辑器对话框，标题显示"编辑文件: <路径>"，内容加载完成后显示在 CodeMirror 编辑器中，支持语法高亮

#### Scenario: 取消编辑
- **WHEN** 用户点击弹窗的"取消"按钮或关闭按钮
- **THEN** 弹窗关闭，不保存任何修改

#### Scenario: 保存文件
- **WHEN** 用户修改内容后点击"保存"按钮
- **THEN** 系统调用保存 API，成功后关闭弹窗并显示成功提示，刷新文件列表

#### Scenario: 保存失败
- **WHEN** 保存 API 返回错误
- **THEN** 弹窗保持打开，显示错误提示信息

#### Scenario: 编辑器加载失败
- **WHEN** 读取文件内容 API 返回错误
- **THEN** 弹窗显示错误信息，编辑器不可用
