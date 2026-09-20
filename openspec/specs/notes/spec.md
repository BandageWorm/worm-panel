## Purpose

在面板中提供 Markdown 记事本能力，笔记以文件形式存储于 data/notes 目录，支持列表、读取与写入。

## Requirements

### Requirement: 笔记存储

系统 SHALL 将笔记以 .md 文件形式存储在 data/notes/ 目录，支持文件系统直接读写。

#### Scenario: 笔记目录初始化
- **WHEN** 面板首次启动
- **THEN** 系统确保 data/notes/ 目录存在

### Requirement: 笔记列表

系统 SHALL 按更新时间排序返回笔记列表。

#### Scenario: 获取笔记列表
- **WHEN** 已认证用户发送 GET /api/notes
- **THEN** 系统返回笔记列表，包含文件名和更新时间

### Requirement: 笔记读写

系统 SHALL 支持笔记的创建、读取、更新、删除操作。

#### Scenario: 读取笔记内容
- **WHEN** 已认证用户发送 GET /api/notes/:name
- **THEN** 系统返回笔记的 Markdown 内容

#### Scenario: 创建笔记
- **WHEN** 已认证用户发送 POST /api/notes，携带 name 和 content
- **THEN** 系统在 data/notes/ 目录创建 .md 文件并返回成功

#### Scenario: 更新笔记
- **WHEN** 已认证用户发送 PUT /api/notes/:name，携带 content
- **THEN** 系统更新对应文件内容

#### Scenario: 触发同步
- **WHEN** 笔记创建或更新成功
- **THEN** 系统异步触发云备份，不阻塞 HTTP 响应

#### Scenario: 删除笔记
- **WHEN** 已认证用户发送 DELETE /api/notes/:name
- **THEN** 系统删除对应 .md 文件

### Requirement: 路径穿越防护

系统 SHALL 校验文件名，防止路径穿越攻击。

#### Scenario: 非法文件名
- **WHEN** 用户请求包含 ../ 等路径穿越字符
- **THEN** 系统返回校验错误，拒绝操作

### Requirement: 笔记管理页面 UI

系统 SHALL 在 /#/notes 提供 Markdown 笔记管理页面。

#### Scenario: 查看笔记列表
- **WHEN** 已认证用户导航到 /notes
- **THEN** 左侧显示笔记列表（文件名、更新时间），右侧显示编辑器

#### Scenario: 编辑笔记
- **WHEN** 用户点击笔记并编辑内容
- **THEN** 右侧编辑器实时编辑，分屏预览 Markdown 渲染效果

#### Scenario: 新建笔记
- **WHEN** 用户点击新建按钮并输入标题和内容
- **THEN** 系统创建笔记并刷新列表

#### Scenario: 保存笔记
- **WHEN** 用户点击保存按钮
- **THEN** 系统更新笔记文件内容

#### Scenario: 删除笔记
- **WHEN** 用户点击删除按钮并确认
- **THEN** 系统删除笔记文件并刷新列表

#### Scenario: 预览模式
- **WHEN** 用户打开笔记
- **THEN** 默认显示 Markdown 渲染预览，可点击按钮切换到编辑模式
- **THEN** 预览模式下渲染标题、代码块、表格、引用等 Markdown 语法

#### Scenario: 导出笔记
- **WHEN** 用户点击导出按钮
- **THEN** 系统将当前笔记内容导出为 .md 文件下载

#### Scenario: 导入笔记
- **WHEN** 用户点击导入按钮并选择 .md 文件
- **THEN** 系统读取文件内容并创建笔记
- **THEN** 若同名笔记已存在，提示用户确认后覆盖
