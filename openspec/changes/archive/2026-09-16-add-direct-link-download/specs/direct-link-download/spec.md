## Purpose

提供文件直链下载能力：登录用户上传文件后获得一条不可猜测的公开下载链接，任何人无需登录即可通过该链接下载文件，支持断点续传与可选过期时间，适合自用的云存储式分享场景。

## ADDED Requirements

### Requirement: 上传文件并生成直链

系统 SHALL 允许已登录用户上传文件到直链专用存储区，并为每个文件生成一个不可猜测的随机 token 作为直链标识。上传单文件大小 MUST NOT 超过 500MB。上传成功后系统 SHALL 返回该文件的 token 与完整直链 URL。系统 SHALL 保存文件的原始文件名、大小、MIME 类型、创建时间等元信息，且实际存储不得使用原始文件名以避免同名覆盖与路径穿越。

#### Scenario: 成功上传并获得直链

- **WHEN** 已登录用户提交一个不超过 500MB 的文件
- **THEN** 系统保存文件到直链专用存储区，生成不可猜测的随机 token，记录原始文件名等元信息，并返回 token 与完整直链 URL

#### Scenario: 上传文件超过大小上限

- **WHEN** 已登录用户提交一个超过 500MB 的文件
- **THEN** 系统拒绝上传并返回文件超限的错误提示，不产生任何直链记录

#### Scenario: 未提供文件

- **WHEN** 已登录用户发起上传请求但未附带任何文件
- **THEN** 系统返回参数错误提示，不产生任何直链记录

### Requirement: 通过公开直链下载文件

系统 SHALL 提供一个无需登录鉴权的公开下载端点，通过 token 访问对应文件。响应 MUST 通过 `Content-Disposition` 头还原原始文件名（含中文等非 ASCII 字符）。当 token 不存在时系统 SHALL 返回 404。

#### Scenario: 通过有效直链下载

- **WHEN** 任意访问者请求一个存在且未过期的 token 对应的直链
- **THEN** 系统返回该文件内容，并在 `Content-Disposition` 头中还原原始文件名

#### Scenario: 访问不存在的 token

- **WHEN** 访问者请求一个不存在的 token
- **THEN** 系统返回 404

### Requirement: 下载断点续传

公开下载端点 SHALL 支持 HTTP `Range` 请求以实现断点续传。系统 SHALL 在响应中声明 `Accept-Ranges: bytes`。当请求包含合法 `Range` 头时，系统 SHALL 返回 206 Partial Content，并附带正确的 `Content-Range` 头以及请求区间对应的字节内容。当 `Range` 区间非法（超出文件大小）时，系统 SHALL 返回 416 Range Not Satisfiable。

#### Scenario: 携带 Range 头请求部分内容

- **WHEN** 访问者对有效直链发起带合法 `Range: bytes=<start>-` 头的请求
- **THEN** 系统返回 206 状态码、正确的 `Content-Range` 头，以及从指定偏移开始的字节内容

#### Scenario: 不带 Range 头的完整下载

- **WHEN** 访问者对有效直链发起不带 `Range` 头的请求
- **THEN** 系统返回 200 状态码、完整文件内容，并声明 `Accept-Ranges: bytes`

#### Scenario: Range 区间非法

- **WHEN** 访问者请求的 `Range` 起始位置超出文件大小
- **THEN** 系统返回 416 Range Not Satisfiable

### Requirement: 直链可选过期时间

系统 SHALL 支持为直链设置可选的过期时间；未设置时直链永久有效。当访问一个已过期的直链时，系统 SHALL 拒绝下载并返回失效响应（404 或 410），不返回文件内容。

#### Scenario: 未设置过期时间的直链永久有效

- **WHEN** 用户上传文件时未指定过期时间，此后任意时间访问该直链
- **THEN** 系统正常返回文件内容

#### Scenario: 访问已过期的直链

- **WHEN** 访问者请求一个已超过其过期时间的直链
- **THEN** 系统拒绝下载并返回失效响应，不返回文件内容

### Requirement: 列出与删除直链

系统 SHALL 允许已登录用户列出所有已创建的直链，每条记录包含 token、原始文件名、大小、创建时间、过期时间（若有）以及完整直链 URL。系统 SHALL 允许已登录用户按 token 删除直链，删除时 MUST 同时移除实际存储文件与其元信息记录。删除后该直链 MUST 立即失效。

#### Scenario: 列出所有直链

- **WHEN** 已登录用户请求直链列表
- **THEN** 系统返回全部直链记录，每条含 token、原始文件名、大小、创建时间、过期时间（若有）与完整直链 URL

#### Scenario: 删除直链

- **WHEN** 已登录用户按 token 删除一条直链
- **THEN** 系统移除对应的存储文件与元信息记录，该直链随即返回 404

#### Scenario: 删除不存在的直链

- **WHEN** 已登录用户删除一个不存在的 token
- **THEN** 系统返回 404 或相应的未找到提示

### Requirement: 管理接口鉴权隔离

直链的上传、列表、删除等管理接口 MUST 要求有效的登录鉴权（JWT）。公开下载端点 MUST NOT 要求任何鉴权。公开下载端点的注册 MUST 优先于前端 SPA 兜底路由，以确保直链请求不被前端路由拦截。

#### Scenario: 未登录访问管理接口

- **WHEN** 未携带有效 JWT 的请求访问直链管理接口（上传/列表/删除）
- **THEN** 系统返回 401 未登录

#### Scenario: 未登录访问公开直链

- **WHEN** 未携带任何鉴权的请求访问有效的公开下载端点
- **THEN** 系统正常返回文件内容，不要求登录
