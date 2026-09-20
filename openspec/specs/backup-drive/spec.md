## Purpose

备份盘提供独立的本地文件存储空间，支持拖拽/点击上传、下载、删除、重命名、新建文件夹和目录导航，每次写操作后自动同步到 WebDAV 云端。

## Requirements

### Requirement: 备份盘文件列表

系统 SHALL 展示备份盘根目录 `data/drive/` 下的文件和文件夹列表。

#### Scenario: 列出根目录内容
- **WHEN** 已认证用户发送 GET /api/drive/list?path=/
- **THEN** 系统返回根目录下的文件和文件夹列表
- **THEN** 每个条目包含：名称、类型（文件/文件夹）、大小、修改时间

#### Scenario: 列出子目录内容
- **WHEN** 已认证用户发送 GET /api/drive/list?path=/subdir
- **THEN** 系统返回指定子目录下的文件和文件夹列表

#### Scenario: 路径穿越防护
- **WHEN** 请求路径包含 `../` 试图访问 drive 目录外
- **THEN** 系统返回 400 错误，拒绝访问

### Requirement: 文件上传

系统 SHALL 支持通过拖拽或点击选择上传文件到备份盘指定目录。

#### Scenario: 上传成功
- **WHEN** 已认证用户 POST /api/drive/upload 带上文件（multipart/form-data）和路径参数
- **THEN** 系统将文件保存到 `data/drive/` 对应路径
- **THEN** 系统触发后台同步到 WebDAV
- **THEN** 系统返回上传后的文件信息

#### Scenario: 上传到子目录
- **WHEN** 用户在子目录中拖拽上传文件
- **THEN** 文件保存到对应的子目录下

#### Scenario: 单文件超过 500MB
- **WHEN** 上传文件大小超过 500MB
- **THEN** 系统返回 413 错误，拒绝上传

#### Scenario: 文件重名
- **WHEN** 上传的文件名与已存在的文件重名
- **THEN** 系统自动追加时间戳后缀避免覆盖

#### Scenario: 上传失败
- **WHEN** 上传过程中发生磁盘错误或异常
- **THEN** 系统返回错误信息，不保存不完整文件

### Requirement: 文件下载

系统 SHALL 支持从备份盘下载文件。

#### Scenario: 下载成功
- **WHEN** 已认证用户 GET /api/drive/download?path=/file.zip
- **THEN** 系统以流式方式返回文件内容
- **THEN** 浏览器触发文件下载

#### Scenario: 下载不存在的文件
- **WHEN** 请求下载的文件不存在
- **THEN** 系统返回 404 错误

#### Scenario: 下载文件夹
- **WHEN** 请求的路径指向文件夹而非文件
- **THEN** 系统返回 400 错误，不支持文件夹下载

### Requirement: 文件删除

系统 SHALL 支持删除备份盘中的文件或文件夹。

#### Scenario: 删除文件成功
- **WHEN** 已认证用户 DELETE /api/drive/ 携带路径参数
- **THEN** 系统删除指定文件
- **THEN** 系统触发后台同步到 WebDAV
- **THEN** 返回删除成功状态

#### Scenario: 删除文件夹成功
- **WHEN** 删除路径指向一个文件夹
- **THEN** 系统递归删除文件夹及其所有内容
- **THEN** 系统触发后台同步到 WebDAV

#### Scenario: 删除确认
- **WHEN** 用户在 UI 点击删除按钮
- **THEN** 系统弹出确认对话框
- **THEN** 用户确认后才执行删除请求

### Requirement: 重命名

系统 SHALL 支持重命名备份盘中的文件或文件夹。

#### Scenario: 重命名成功
- **WHEN** 已认证用户 PUT /api/drive/rename 携带原路径和新名称
- **THEN** 系统执行重命名操作
- **THEN** 系统触发后台同步到 WebDAV
- **THEN** 返回重命名后的文件信息

#### Scenario: 重命名后名称已存在
- **WHEN** 新名称与同一目录下已有文件/文件夹重名
- **THEN** 系统返回 409 冲突错误

### Requirement: 新建文件夹

系统 SHALL 支持在备份盘中创建新文件夹。

#### Scenario: 新建文件夹成功
- **WHEN** 已认证用户 POST /api/drive/mkdir 携带路径参数
- **THEN** 系统在指定路径下创建文件夹
- **THEN** 系统触发后台同步到 WebDAV
- **THEN** 返回文件夹信息

#### Scenario: 文件夹已存在
- **WHEN** 指定路径的文件夹已存在
- **THEN** 系统返回 409 冲突错误

### Requirement: 备份盘页面 UI

系统 SHALL 在 /#/sync 页面的云备份状态卡片和备份历史之间提供备份盘卡片。

#### Scenario: 显示备份盘卡片
- **WHEN** 用户导航到 /sync 页面
- **THEN** 页面在状态卡片下方显示「备份盘」卡片
- **THEN** 卡片包含拖拽上传区域和文件列表

#### Scenario: 拖拽上传
- **WHEN** 用户拖拽文件到上传区域
- **THEN** 区域高亮显示
- **THEN** 松开后文件自动上传到当前目录
- **THEN** 上传完成后刷新文件列表

#### Scenario: 点击上传
- **WHEN** 用户点击上传区域
- **THEN** 系统弹出文件选择对话框，支持多文件选择
- **THEN** 选择后文件自动上传到当前目录
- **THEN** 上传完成后刷新文件列表

#### Scenario: 文件夹导航
- **WHEN** 用户点击文件夹条目
- **THEN** 页面进入该文件夹，显示其内容
- **THEN** 面包屑导航更新，支持逐级返回

#### Scenario: 下载文件
- **WHEN** 用户点击文件行的下载按钮
- **THEN** 浏览器下载该文件

#### Scenario: 删除文件
- **WHEN** 用户点击文件行的删除按钮
- **THEN** 弹窗确认后执行删除
- **THEN** 删除后刷新文件列表

#### Scenario: 重命名文件
- **WHEN** 用户点击文件行的重命名按钮（或双击文件名）
- **THEN** 文件名进入行内编辑模式
- **THEN** 用户确认后执行重命名
- **THEN** 重命名后刷新文件列表

#### Scenario: 新建文件夹按钮
- **WHEN** 用户点击「新建文件夹」按钮
- **THEN** 弹出对话框输入文件夹名称
- **THEN** 确认后在当前目录创建文件夹
- **THEN** 创建后刷新文件列表

#### Scenario: 未连接 WebDAV 时
- **WHEN** WebDAV 未连接或 rclone 未安装
- **THEN** 备份盘卡片正常显示
- **THEN** 上传/删除/重命名等本地操作正常可用
- **THEN** 页面提示「未连接到云端，文件仅保存在本地」

#### Scenario: 响应式布局
- **WHEN** 在手机端访问 /sync 页面
- **THEN** 备份盘卡片全宽显示
- **THEN** 文件列表列数自适应减少
- **THEN** 操作按钮折叠或使用图标

### Requirement: 备份历史记录

系统 SHALL 使用独立文件 `data/sync-history.json` 存储备份历史，上限 20 条。

#### Scenario: 查询历史
- **WHEN** 已认证用户发送 GET /api/sync/history
- **THEN** 系统返回 `data/sync-history.json` 中的历史记录列表（时间、状态、来源、文件数、大小）

#### Scenario: 旧配置迁移
- **WHEN** 系统第一次读取历史且 `data/sync-history.json` 不存在但 `config.json` 中有旧历史
- **THEN** 系统自动从 config 迁移到独立文件
- **THEN** 清理 config 中的历史字段

#### Scenario: 来源区分
- **WHEN** 历史记录来自笔记备份
- **THEN** 来源标记为「笔记备份」
- **WHEN** 历史记录来自备份盘同步
- **THEN** 来源标记为「备份盘」
- **THEN** UI 用不同颜色标签区分

### Requirement: 独立文件存储

系统 SHALL 将同步历史存储为独立文件，不耦合在 config.json 中。

#### Scenario: 存储路径
- **THEN** 文件路径为 `data/sync-history.json`

#### Scenario: 上限控制
- **THEN** 最多保留 20 条记录
- **THEN** 超出上限时删除最旧记录
