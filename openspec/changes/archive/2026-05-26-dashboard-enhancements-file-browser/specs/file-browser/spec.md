## ADDED Requirements

### Requirement: 目录内容浏览

系统应支持浏览指定目录的文件和子目录列表。

#### Scenario：列出目录内容
- **WHEN** 已认证用户发送 GET /api/files，携带 path 参数（如 `/root` 或 `/var/www`）
- **THEN** 系统返回该目录下的文件和子目录列表，每项包含名称、类型（file/dir）、大小、修改时间、权限

#### Scenario：路径不存在
- **WHEN** 已认证用户发送 GET /api/files，path 指向不存在的目录
- **THEN** 系统返回 404 错误

#### Scenario：路径穿越防护
- **WHEN** path 参数包含 `..` 或其他路径穿越字符
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 文件下载

系统应支持通过 API 下载指定文件。

#### Scenario：下载文件
- **WHEN** 已认证用户发送 GET /api/files/download，携带 path 参数指向一个文件
- **THEN** 系统以 application/octet-stream 流式返回文件内容

#### Scenario：下载目录
- **WHEN** path 指向一个目录
- **THEN** 系统返回错误，不支持目录下载

### Requirement: 文件上传

系统应支持通过 multipart/form-data 上传文件到指定目录。

#### Scenario：成功上传文件
- **WHEN** 已认证用户发送 POST /api/files/upload，携带目标 path 目录和 file 字段的文件数据
- **THEN** 系统将文件保存到目标目录，返回文件信息

#### Scenario：上传到不存在的目录
- **WHEN** path 指向不存在的目录
- **THEN** 系统返回错误

### Requirement: 文件删除

系统应支持删除文件或空目录。

#### Scenario：删除文件
- **WHEN** 已认证用户发送 DELETE /api/files，携带 path 指向一个文件
- **THEN** 系统删除该文件并返回成功

#### Scenario：删除非空目录
- **WHEN** path 指向一个非空目录
- **THEN** 系统返回错误，提示目录不为空

### Requirement: 新建目录

系统应支持在指定路径下创建新目录。

#### Scenario：成功创建目录
- **WHEN** 已认证用户发送 POST /api/files/mkdir，携带 path 参数
- **THEN** 系统创建该目录并返回成功

#### Scenario：目录已存在
- **WHEN** path 已存在
- **THEN** 系统返回错误

### Requirement: 文件浏览 UI

仪表盘页面应提供文件浏览面板。

#### Scenario：查看文件列表
- **WHEN** 已认证用户进入仪表盘，滚动到文件浏览区域
- **THEN** 页面显示文件列表表格，包含文件名、大小、类型、修改时间列

#### Scenario：进入子目录
- **WHEN** 用户双击一个目录行
- **THEN** 页面进入该目录，刷新文件列表，面包屑更新

#### Scenario：返回上级目录
- **WHEN** 用户点击面包屑中的上级目录
- **THEN** 页面导航到对应目录

#### Scenario：上传文件
- **WHEN** 用户点击上传按钮，选择文件并确认
- **THEN** 文件上传到当前目录，列表刷新

#### Scenario：下载文件
- **WHEN** 用户点击文件行的下载按钮
- **THEN** 浏览器触发文件下载

#### Scenario：删除文件
- **WHEN** 用户点击文件行的删除按钮并确认
- **THEN** 系统删除文件，列表刷新

#### Scenario：新建目录
- **WHEN** 用户点击新建目录按钮，输入目录名并确认
- **THEN** 在当前目录下创建目录，列表刷新
