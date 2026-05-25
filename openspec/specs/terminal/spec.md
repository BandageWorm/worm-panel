## 新增需求

### 需求：WebSocket 终端连接

系统应在 WebSocket 连接上提供交互式 bash shell 终端。

#### 场景：建立终端连接
- **当** 已认证用户通过 WebSocket 连接到 `/api/terminal?token=<jwt>`，携带终端大小参数 cols/rows
- **则** 系统验证 JWT 后在服务端 spawn /bin/bash 进程，通过 pty 转发输入输出

#### 场景：执行命令
- **当** WebSocket 连接已建立，用户发送 JSON 消息 `{ type: 'input', data: 'ls -la\n' }`
- **则** 系统将数据写入 pty，bash 执行命令，输出通过 WebSocket 返回 `{ type: 'output', data: '...' }`

#### 场景：窗口大小调整
- **当** 用户发送 `{ type: 'resize', cols: 80, rows: 24 }`
- **则** 系统调整 pty 窗口大小

#### 场景：终端断开
- **当** WebSocket 连接关闭
- **则** 系统 kill pty 进程，清理资源

#### 场景：认证失败
- **当** WebSocket 连接请求未携带有效 JWT token
- **则** 系统关闭连接并返回 401

### 需求：终端页面 UI

系统应在 /#/terminal 提供终端页面。

#### 场景：显示终端
- **当** 已认证用户导航到 /terminal
- **则** 页面显示 xterm.js 终端界面，自动连接 WebSocket 并显示 bash 提示符

#### 场景：输入命令
- **当** 用户聚焦终端并输入命令
- **则** 命令发送到服务器执行，输出实时显示在终端中

#### 场景：终端断开重连
- **当** WebSocket 意外断开
- **则** 终端显示"连接已断开"提示，每 3 秒自动尝试重连

#### 场景：终端最小化
- **当** 用户点击终端区域的折叠按钮
- **则** 终端区域折叠，仅保留标题栏
