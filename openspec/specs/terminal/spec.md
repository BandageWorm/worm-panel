## Purpose

在面板中提供基于 WebSocket 的在线终端能力，支持在浏览器中打开交互式 shell 会话、实时收发输入输出，并提供对应的终端页面用于日常命令行操作。

## Requirements

### Requirement: WebSocket 终端连接

系统 SHALL 在 WebSocket 连接上提供交互式 bash shell 终端。

#### Scenario: 建立终端连接
- **WHEN** 已认证用户通过 WebSocket 连接到 `/api/terminal?token=<jwt>`，携带终端大小参数 cols/rows
- **THEN** 系统验证 JWT 后在服务端 spawn /bin/bash 进程，通过 pty 转发输入输出

#### Scenario: 执行命令
- **WHEN** WebSocket 连接已建立，用户发送 JSON 消息 `{ type: 'input', data: 'ls -la\n' }`
- **THEN** 系统将数据写入 pty，bash 执行命令，输出通过 WebSocket 返回 `{ type: 'output', data: '...' }`

#### Scenario: 窗口大小调整
- **WHEN** 用户发送 `{ type: 'resize', cols: 80, rows: 24 }`
- **THEN** 系统调整 pty 窗口大小

#### Scenario: 终端断开
- **WHEN** WebSocket 连接关闭
- **THEN** 系统 kill pty 进程，清理资源

#### Scenario: 认证失败
- **WHEN** WebSocket 连接请求未携带有效 JWT token
- **THEN** 系统关闭连接并返回 401

### Requirement: 终端页面 UI

系统 SHALL 在 /#/terminal 提供终端页面。

#### Scenario: 显示终端
- **WHEN** 已认证用户导航到 /terminal
- **THEN** 页面显示 xterm.js 终端界面，自动连接 WebSocket 并显示 bash 提示符

#### Scenario: 输入命令
- **WHEN** 用户聚焦终端并输入命令
- **THEN** 命令发送到服务器执行，输出实时显示在终端中

#### Scenario: 终端断开重连
- **WHEN** WebSocket 意外断开
- **THEN** 终端显示"连接已断开"提示，每 3 秒自动尝试重连

#### Scenario: 终端最小化
- **WHEN** 用户点击终端区域的折叠按钮
- **THEN** 终端区域折叠，仅保留标题栏
