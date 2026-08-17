### Requirement: 查看防火墙状态
系统 SHALL 提供 API 返回 ufw 防火墙当前状态（启用/关闭）和默认策略。

#### Scenario: ufw 已启用
- **WHEN** 用户请求 `GET /api/firewall/status`
- **THEN** 返回 `{ enabled: true, defaultPolicy: "deny" }`

#### Scenario: ufw 未启用
- **WHEN** 用户请求 `GET /api/firewall/status` 且 ufw 处于 inactive 状态
- **THEN** 返回 `{ enabled: false, defaultPolicy: null }`

#### Scenario: ufw 未安装
- **WHEN** 用户请求 `GET /api/firewall/status` 且系统未安装 ufw
- **THEN** 返回 `{ available: false, error: "ufw 未安装" }`

### Requirement: 查看防火墙规则列表
系统 SHALL 提供 API 返回当前所有 ufw 规则，包含编号、端口、协议、动作、来源信息。

#### Scenario: 获取规则列表
- **WHEN** 用户请求 `GET /api/firewall/rules`
- **THEN** 返回规则数组，每条包含 `{ id, to, action, from, protocol, v6 }` 字段

#### Scenario: 无规则时
- **WHEN** 用户请求 `GET /api/firewall/rules` 且 ufw 无任何规则
- **THEN** 返回空数组 `[]`

### Requirement: 添加防火墙规则
系统 SHALL 提供 API 添加 ufw 规则，支持指定端口、协议、动作和来源。

#### Scenario: 添加允许端口规则
- **WHEN** 用户请求 `POST /api/firewall/rules` 传入 `{ port: 3000, protocol: "tcp", action: "allow" }`
- **THEN** 执行 `ufw allow 3000/tcp`，返回成功

#### Scenario: 添加拒绝来源规则
- **WHEN** 用户请求 `POST /api/firewall/rules` 传入 `{ port: 22, protocol: "tcp", action: "deny", from: "1.2.3.4" }`
- **THEN** 执行 `ufw deny from 1.2.3.4 to any port 22 proto tcp`，返回成功

#### Scenario: 添加端口范围规则
- **WHEN** 用户请求 `POST /api/firewall/rules` 传入 `{ port: "8000:8100", protocol: "tcp", action: "allow" }`
- **THEN** 执行 `ufw allow 8000:8100/tcp`，返回成功

### Requirement: 删除防火墙规则
系统 SHALL 提供 API 按规则编号删除 ufw 规则。

#### Scenario: 正常删除规则
- **WHEN** 用户请求 `DELETE /api/firewall/rules/:id` 且该规则不是面板端口
- **THEN** 执行 `ufw --force delete <id>`，返回成功

#### Scenario: 删除面板端口规则被拒绝
- **WHEN** 用户请求删除的规则目标端口是面板当前运行端口
- **THEN** 返回 400 错误 `{ error: "不能删除面板自身端口的规则" }`

### Requirement: 面板端口保护
系统 SHALL 保护面板当前运行端口的防火墙规则不被删除，防止用户锁死面板访问。

#### Scenario: 识别面板端口规则
- **WHEN** 获取规则列表时
- **THEN** 面板端口对应的规则 MUST 标记 `locked: true`

#### Scenario: 后端阻止删除面板端口规则
- **WHEN** 删除请求的目标规则端口匹配面板配置端口
- **THEN** 后端 MUST 拒绝操作，返回错误信息

### Requirement: 启用/关闭防火墙
系统 SHALL 提供 API 启用或关闭 ufw 防火墙。

#### Scenario: 启用防火墙
- **WHEN** 用户请求 `POST /api/firewall/enable`
- **THEN** 执行 `ufw --force enable`，返回成功

#### Scenario: 关闭防火墙
- **WHEN** 用户请求 `POST /api/firewall/disable`
- **THEN** 执行 `ufw --force disable`，返回成功

### Requirement: 防火墙管理页面
前端 SHALL 提供防火墙管理页面，展示状态、规则列表、添加/删除操作。

#### Scenario: 页面展示
- **WHEN** 用户导航到防火墙页面
- **THEN** 展示防火墙开关状态、规则表格（端口、协议、动作、来源、操作按钮）、添加规则按钮

#### Scenario: 面板端口规则不可删除
- **WHEN** 页面展示规则列表
- **THEN** 面板端口的规则行删除按钮 MUST 禁用，显示锁定图标

#### Scenario: 删除 SSH 端口规则二次确认
- **WHEN** 用户点击删除 22 端口的规则
- **THEN** 系统 MUST 弹出确认对话框警告可能导致 SSH 无法连接

### Requirement: 侧边栏导航入口
前端 SHALL 在侧边栏添加防火墙菜单项，位于「终端」之后、「Nginx」之前。

#### Scenario: 菜单位置
- **WHEN** 用户查看侧边栏
- **THEN** 防火墙菜单项位于终端和 Nginx 之间
