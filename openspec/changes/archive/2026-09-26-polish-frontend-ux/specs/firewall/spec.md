# Spec Delta

## MODIFIED Requirements

### Requirement: 防火墙管理页面

前端 SHALL 提供防火墙管理页面，展示状态、规则列表、添加/删除操作，且 SHALL 在手机端保持可用。

#### Scenario: 页面展示

- **WHEN** 用户导航到防火墙页面
- **THEN** 展示防火墙开关状态、规则表格（端口、协议、动作、来源、操作按钮）、添加规则按钮

#### Scenario: 面板端口规则不可删除

- **WHEN** 页面展示规则列表
- **THEN** 面板端口的规则行删除按钮 MUST 禁用，显示锁定图标

#### Scenario: 删除 SSH 端口规则二次确认

- **WHEN** 用户点击删除 22 端口的规则
- **THEN** 系统 MUST 弹出确认对话框警告可能导致 SSH 无法连接

#### Scenario: 手机端可用性

- **WHEN** 在窄屏（≤768px）设备上访问防火墙页面
- **THEN** 规则表格 SHALL 可横向滚动而不撑破容器，添加规则对话框宽度 SHALL 自适应屏幕而非固定像素，操作按钮 SHALL 保持可点击
