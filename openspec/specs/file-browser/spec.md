## Purpose

在面板中提供服务器文件系统的可视化管理能力，支持目录浏览、上传下载、在线编辑，以及重命名、移动、复制、删除、压缩解压、权限修改和批量操作等常规文件管理动作。

## Requirements

### Requirement: 目录内容浏览

系统 SHALL 支持浏览指定目录的文件和子目录列表。

#### Scenario: 列出目录内容
- **WHEN** 已认证用户发送 GET /api/files，携带 path 参数（如 `/root` 或 `/var/www`）
- **THEN** 系统返回该目录下的文件和子目录列表，每项包含名称、类型（file/dir）、大小、修改时间、权限

#### Scenario: 路径不存在
- **WHEN** 已认证用户发送 GET /api/files，path 指向不存在的目录
- **THEN** 系统返回 404 错误

#### Scenario: 路径穿越防护
- **WHEN** path 参数包含 `..` 或其他路径穿越字符
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 文件下载

系统 SHALL 支持通过 API 下载指定文件。

#### Scenario: 下载文件
- **WHEN** 已认证用户发送 GET /api/files/download，携带 path 参数指向一个文件
- **THEN** 系统以 application/octet-stream 流式返回文件内容

#### Scenario: 下载目录
- **WHEN** path 指向一个目录
- **THEN** 系统返回错误，不支持目录下载

### Requirement: 文件上传

系统 SHALL 支持通过 multipart/form-data 上传文件到指定目录。

#### Scenario: 成功上传文件
- **WHEN** 已认证用户发送 POST /api/files/upload，携带目标 path 目录和 file 字段的文件数据
- **THEN** 系统将文件保存到目标目录，返回文件信息

#### Scenario: 上传到不存在的目录
- **WHEN** path 指向不存在的目录
- **THEN** 系统返回错误

### Requirement: 文件删除

系统 SHALL 支持删除文件或目录，目录支持递归删除。

#### Scenario: 删除文件
- **WHEN** 已认证用户发送 DELETE /api/files，携带 path 指向一个文件
- **THEN** 系统删除该文件并返回成功

#### Scenario: 删除空目录
- **WHEN** path 指向一个空目录
- **THEN** 系统删除该目录并返回成功

#### Scenario: 删除非空目录（递归）
- **WHEN** path 指向一个非空目录，且请求指明递归删除（如 recursive=true）
- **THEN** 系统递归删除该目录及其全部内容并返回成功

#### Scenario: 未指明递归时删除非空目录
- **WHEN** path 指向一个非空目录，但请求未指明递归删除
- **THEN** 系统返回错误，提示目录不为空，需确认递归删除

### Requirement: 新建目录

系统 SHALL 支持在指定路径下创建新目录。

#### Scenario: 成功创建目录
- **WHEN** 已认证用户发送 POST /api/files/mkdir，携带 path 参数
- **THEN** 系统创建该目录并返回成功

#### Scenario: 目录已存在
- **WHEN** path 已存在
- **THEN** 系统返回错误

### Requirement: 文件浏览页面 UI

系统 SHALL 在 /#/files 提供文件管理页面。

#### Scenario: 查看文件列表
- **WHEN** 已认证用户导航到 /files
- **THEN** 页面显示文件列表表格，包含文件名、大小、类型、修改时间、权限列，支持面包屑导航

#### Scenario: 权限列可编辑
- **WHEN** 用户查看文件列表
- **THEN** 每行权限列显示当前八进制权限，并提供修改入口，点击后可修改权限（chmod）

#### Scenario: 进入子目录
- **WHEN** 用户双击一个目录行
- **THEN** 页面进入该目录，刷新文件列表，面包屑更新

#### Scenario: 返回上级目录
- **WHEN** 用户点击面包屑中的上级目录
- **THEN** 页面导航到对应目录

#### Scenario: 列头排序
- **WHEN** 用户点击表格列头（名称/大小/修改时间）的排序按钮
- **THEN** 当前目录的文件列表按该列升序排列，再次点击切换为降序，目录始终排在文件前面

#### Scenario: 复制当前路径
- **WHEN** 用户点击面包屑旁的复制按钮
- **THEN** 当前完整路径复制到剪贴板，显示复制成功提示

#### Scenario: 切换路径输入模式
- **WHEN** 用户点击面包屑旁的编辑路径按钮
- **THEN** 面包屑切换为文本输入框，预填当前路径，支持手动修改

#### Scenario: 通过路径输入框导航
- **WHEN** 用户在路径输入框中输入路径后按回车
- **THEN** 系统验证路径，若有效则导航到该目录并切回面包屑模式；若无效则提示路径不存在

#### Scenario: 双击文件打开编辑
- **WHEN** 用户双击一个可编辑文件的行
- **THEN** 弹出编辑器弹窗，行为同点击"编辑"按钮

#### Scenario: 上传文件
- **WHEN** 用户点击上传按钮，选择文件并确认
- **THEN** 文件上传到当前目录，列表刷新

#### Scenario: 下载文件
- **WHEN** 用户点击文件行的下载按钮
- **THEN** 浏览器触发文件下载

#### Scenario: 删除文件
- **WHEN** 用户点击文件行的删除按钮并确认
- **THEN** 系统删除文件或目录（非空目录经二次确认后递归删除），列表刷新

#### Scenario: 新建目录
- **WHEN** 用户点击新建目录按钮，输入目录名并确认
- **THEN** 在当前目录下创建目录，列表刷新

### Requirement: 读取文件内容

系统 SHALL 支持读取文本文件的内容并以 UTF-8 返回。

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

系统 SHALL 支持以 UTF-8 编码保存内容到指定文件。

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

系统 SHALL 在文件管理页面提供文本编辑器弹窗。

#### Scenario: 显示编辑按钮
- **WHEN** 文件列表中的文件扩展名匹配可编辑类型白名单
- **THEN** 该文件行的操作列显示"编辑"按钮

#### Scenario: 隐藏编辑按钮
- **WHEN** 文件扩展名不在白名单中，或该项是目录
- **THEN** 操作列不显示"编辑"按钮

#### Scenario: 打开编辑弹窗
- **WHEN** 用户点击"编辑"按钮
- **THEN** 弹出编辑器对话框，标题显示"编辑文件: <路径>"，内容加载完成后显示在 CodeMirror 编辑器中，支持语法高亮

#### Scenario: 移动端编辑器字号
- **WHEN** 在宽度 ≤768px 的设备上打开编辑器
- **THEN** CodeMirror 文本字号自动调整为 12px

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
### Requirement: 重命名文件或目录

系统 SHALL 支持在同一目录内重命名文件或目录。

#### Scenario: 成功重命名
- **WHEN** 已认证用户发送 POST /api/files/rename，body 为 `{ path: "<原路径>", newName: "<新名称>" }`
- **THEN** 系统将该文件或目录重命名为新名称（保持在同一父目录），返回成功

#### Scenario: 新名称为空或包含路径分隔符
- **WHEN** newName 为空，或包含 `/` 等路径分隔符
- **THEN** 系统返回 400 错误，提示名称非法

#### Scenario: 目标名称已存在
- **WHEN** 同目录下已存在同名文件或目录
- **THEN** 系统返回错误，提示目标已存在

#### Scenario: 原路径不存在
- **WHEN** path 指向不存在的文件或目录
- **THEN** 系统返回 404 错误

#### Scenario: 路径穿越防护
- **WHEN** path 或 newName 触发路径穿越，或落入敏感系统路径
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 移动文件或目录

系统 SHALL 支持将文件或目录移动到目标目录（可跨目录），目标目录不存在时自动创建。

#### Scenario: 成功移动到已存在目录
- **WHEN** 已认证用户发送 POST /api/files/move，body 为 `{ src: "<源路径>", dest: "<已存在的目标目录>" }`
- **THEN** 系统将源移动为 `<目标目录>/<源名称>`，返回成功

#### Scenario: 目标目录不存在时自动创建
- **WHEN** dest 指向一个不存在的目录路径
- **THEN** 系统自动创建该目录（含多级），再将源移入其中，返回成功

#### Scenario: 目标处已存在同名项
- **WHEN** 目标目录下已存在与源同名的项
- **THEN** 系统返回错误，提示目标已存在，不覆盖

#### Scenario: 目标是已存在的文件
- **WHEN** dest 指向一个已存在的文件（而非目录）
- **THEN** 系统返回错误，提示目标已存在且不是目录

#### Scenario: 源路径不存在
- **WHEN** src 指向不存在的项
- **THEN** 系统返回 404 错误

#### Scenario: 路径穿越防护
- **WHEN** src 或 dest 触发路径穿越，或落入敏感系统路径
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 复制文件或目录

系统 SHALL 支持将文件或目录复制到目标目录（目录递归复制），目标目录不存在时自动创建。

#### Scenario: 成功复制文件到目标目录
- **WHEN** 已认证用户发送 POST /api/files/copy，body 为 `{ src: "<源文件>", dest: "<目标目录>" }`
- **THEN** 系统将该文件复制为 `<目标目录>/<源名称>`，返回成功

#### Scenario: 成功复制目录
- **WHEN** src 指向一个目录
- **THEN** 系统递归复制该目录及其全部内容到目标目录下，返回成功

#### Scenario: 目标目录不存在时自动创建
- **WHEN** dest 指向一个不存在的目录路径
- **THEN** 系统自动创建该目录（含多级），再将源复制到其中，返回成功

#### Scenario: 目标处已存在同名项时自动加后缀
- **WHEN** 目标目录下已存在与源同名的项
- **THEN** 系统在文件名（扩展名前）追加 `_bak` 生成副本，再冲突则递增为 `_bak2`、`_bak3`…，返回最终副本路径

#### Scenario: 源路径不存在
- **WHEN** src 指向不存在的项
- **THEN** 系统返回 404 错误

#### Scenario: 路径穿越防护
- **WHEN** src 或 dest 触发路径穿越，或落入敏感系统路径
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 新建空文件

系统 SHALL 支持在指定路径创建一个空文件。

#### Scenario: 成功创建空文件
- **WHEN** 已认证用户发送 POST /api/files/newfile，body 为 `{ path: "<文件路径>" }`
- **THEN** 系统在该路径创建一个空文件，返回成功

#### Scenario: 文件已存在
- **WHEN** path 已存在
- **THEN** 系统返回错误，提示已存在，不覆盖

#### Scenario: 父目录不存在
- **WHEN** path 的父目录不存在
- **THEN** 系统返回 400 错误

#### Scenario: 路径穿越防护
- **WHEN** path 触发路径穿越，或落入敏感系统路径
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 解压压缩包

系统 SHALL 支持将 `.tar`、`.tar.gz`/`.tgz`、`.zip` 压缩包解压到指定目录。

#### Scenario: 成功解压
- **WHEN** 已认证用户发送 POST /api/files/extract，body 为 `{ path: "<压缩包路径>", dest: "<目标目录，可选，默认压缩包所在目录>" }`
- **THEN** 系统调用对应系统命令（tar/unzip）将内容解压到目标目录，返回成功

#### Scenario: 不支持的压缩格式
- **WHEN** path 的扩展名不属于支持的压缩格式
- **THEN** 系统返回 400 错误，提示不支持的格式

#### Scenario: 所需解压命令缺失
- **WHEN** 目标环境缺少对应的解压命令（如 unzip 未安装）
- **THEN** 系统返回错误，提示缺少所需命令

#### Scenario: 权限不足自动提权
- **WHEN** 解压过程因权限不足失败
- **THEN** 系统自动以 sudo 重试该命令

#### Scenario: 路径穿越防护
- **WHEN** path 或 dest 触发路径穿越，或落入敏感系统路径
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 压缩文件或目录

系统 SHALL 支持将文件或目录打包为 `.tar.gz` 或 `.zip`。

#### Scenario: 成功压缩
- **WHEN** 已认证用户发送 POST /api/files/compress，body 为 `{ path: "<源文件或目录>", format: "tar.gz|zip", dest: "<输出压缩包路径，可选>" }`
- **THEN** 系统调用对应系统命令生成压缩包，返回生成的压缩包路径

#### Scenario: 不支持的目标格式
- **WHEN** format 不是 `tar.gz` 或 `zip`
- **THEN** 系统返回 400 错误

#### Scenario: 源路径不存在
- **WHEN** path 指向不存在的项
- **THEN** 系统返回 404 错误

#### Scenario: 路径穿越防护
- **WHEN** path 或 dest 触发路径穿越，或落入敏感系统路径
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 修改文件权限

系统 SHALL 支持修改文件或目录的权限位（chmod）。

#### Scenario: 成功修改权限
- **WHEN** 已认证用户发送 POST /api/files/chmod，body 为 `{ path: "<路径>", mode: "755" }`（三位或四位八进制）
- **THEN** 系统将该路径的权限设置为指定值，返回成功

#### Scenario: 非法权限值
- **WHEN** mode 不是合法的八进制权限字符串
- **THEN** 系统返回 400 错误

#### Scenario: 权限不足自动提权
- **WHEN** 修改权限因当前进程权限不足失败
- **THEN** 系统自动以 sudo 重试

#### Scenario: 路径不存在
- **WHEN** path 指向不存在的项
- **THEN** 系统返回 404 错误

#### Scenario: 路径穿越防护
- **WHEN** path 触发路径穿越，或落入敏感系统路径
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 批量删除

系统 SHALL 支持一次删除多个文件或目录。

#### Scenario: 成功批量删除
- **WHEN** 已认证用户发送 POST /api/files/batch-delete，body 为 `{ paths: ["<路径1>", "<路径2>", ...] }`
- **THEN** 系统逐项删除（目录递归删除），返回每项的成功或失败结果

#### Scenario: 部分失败
- **WHEN** 其中部分路径删除失败（如不存在或无权限）
- **THEN** 系统继续处理剩余项，并在结果中标明每项的成败

#### Scenario: 路径穿越防护
- **WHEN** 任一路径触发路径穿越，或落入敏感系统路径
- **THEN** 该项被拒绝并在结果中标为失败

### Requirement: 批量移动

系统 SHALL 支持将多个文件或目录移动到同一目标目录。

#### Scenario: 成功批量移动
- **WHEN** 已认证用户发送 POST /api/files/batch-move，body 为 `{ paths: ["<路径1>", ...], dest: "<目标目录>" }`
- **THEN** 系统将每一项移动到目标目录下，返回每项的成功或失败结果

#### Scenario: 目标目录不存在时自动创建
- **WHEN** dest 指向一个不存在的目录路径
- **THEN** 系统自动创建该目录后，将各项移入其中

#### Scenario: 目标是已存在的文件
- **WHEN** dest 指向一个已存在的文件（而非目录）
- **THEN** 系统返回 400 错误

#### Scenario: 部分失败
- **WHEN** 其中部分项移动失败（如目标已存在同名）
- **THEN** 系统继续处理剩余项，并在结果中标明每项的成败

### Requirement: 批量压缩

系统 SHALL 支持将多个（位于同一目录的）文件或目录打包为单个压缩包（tar.gz 或 zip）。

#### Scenario: 成功批量压缩
- **WHEN** 已认证用户发送 POST /api/files/batch-compress，body 为 `{ paths: ["<路径1>", ...], format: "tar.gz|zip", dest: "<输出路径，可选>" }`
- **THEN** 系统将所有项打包为一个压缩包（默认 archive.tar.gz/archive.zip），返回压缩包路径

#### Scenario: 跨目录项
- **WHEN** 选中的项不在同一目录下
- **THEN** 系统返回错误，提示批量压缩要求所有项位于同一目录

#### Scenario: 输出包已存在时自动加后缀
- **WHEN** 默认输出包名已存在
- **THEN** 系统追加 `_bak` 后缀避免冲突，再冲突则递增

#### Scenario: 不支持的格式
- **WHEN** format 不是 tar.gz 或 zip
- **THEN** 系统返回 400 错误

#### Scenario: 缺少所需命令
- **WHEN** 目标环境缺少对应的压缩命令（如 zip 未安装）
- **THEN** 系统返回错误，提示缺少所需命令

#### Scenario: 路径穿越防护
- **WHEN** 任一路径触发路径穿越，或落入敏感系统路径
- **THEN** 系统拒绝请求并返回校验错误

### Requirement: 文件管理页面扩展操作 UI

系统 SHALL 在文件管理页面提供重命名、移动、复制、压缩/解压、权限修改、新建文件、批量操作（删除/移动/压缩）、文件名搜索的入口。

#### Scenario: 重命名操作
- **WHEN** 用户在文件行触发"重命名"，输入新名称并确认
- **THEN** 系统重命名该项，列表刷新

#### Scenario: 移动/复制操作
- **WHEN** 用户在文件行触发"移动"或"复制"，选择或输入目标路径并确认
- **THEN** 系统执行移动或复制，列表刷新

#### Scenario: 新建文件
- **WHEN** 用户点击"新建文件"，输入文件名并确认
- **THEN** 系统在当前目录创建空文件，列表刷新

#### Scenario: 解压操作
- **WHEN** 用户在压缩包文件行触发"解压"并确认目标目录
- **THEN** 系统解压该压缩包，列表刷新

#### Scenario: 压缩操作
- **WHEN** 用户在文件或目录行触发"压缩"，选择格式并确认
- **THEN** 系统生成压缩包，列表刷新

#### Scenario: 权限修改
- **WHEN** 用户在文件行触发"权限"，修改权限值并确认
- **THEN** 系统 chmod 该项，列表刷新并显示新权限

#### Scenario: 文件名搜索
- **WHEN** 用户在搜索框输入关键字
- **THEN** 当前目录列表仅显示名称包含该关键字的项

#### Scenario: 批量选择与操作
- **WHEN** 用户勾选多行后点击批量删除、批量移动或批量压缩
- **THEN** 系统弹出二次确认（删除时），执行批量操作，列表刷新

#### Scenario: 批量压缩
- **WHEN** 用户勾选多行后点击"批量压缩"，选择格式并确认
- **THEN** 系统将选中项打包为一个压缩包，列表刷新
