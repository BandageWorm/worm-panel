## MODIFIED Requirements

### Requirement：3X-UI 运行状态检测

#### Scenario：检测 3X-UI 状态
- **WHEN** 已认证用户发送 GET /api/xui/status
- **THEN** 系统检测 systemctl status x-ui，返回安装状态、运行状态、端口、安装路径

### Requirement：3X-UI 管理页面 UI

#### Scenario：查看 3X-UI 状态
- **WHEN** 已认证用户导航到 /xui
- **THEN** 页面显示状态卡片（安装状态、运行状态、管理端口、安装路径），不再显示版本号和详细信息卡片

## REMOVED Requirements

### Requirement：获取详细信息

**Reason**: 统计信息不够准确且用途有限。安装路径已移至顶部状态卡片展示。

**Migration**: 安装路径信息通过 GET /api/xui/status 返回的 installPath 字段获取，不再需要单独的详细信息卡片。
