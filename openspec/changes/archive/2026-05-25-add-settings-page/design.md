## Context

面板目前没有设置页面，/settings 路由指向 Placeholder.vue。用户修改端口、域名、模式或密码时只能直接编辑 `data/config.json` 或通过初始化设置流程。现需提供一个完整的设置界面，覆盖日常运维的配置变更需求。

相关文件：
- `src/services/config.js` — 配置读写（load/save）
- `src/index.js` — Express 应用入口，需注册新路由
- `client/src/router/index.js` — 已有 /settings 路由
- `client/src/views/Placeholder.vue` — 当前占位页
- `src/services/nginx.js` — writeSelfConfig() 用于 proxy 模式生成 nginx 配置
- `src/utils/crypto.js` — hashPassword 用于密码修改

## Goals / Non-Goals

**Goals:**
- 提供 REST API 读取和修改面板配置（GET/PUT /api/settings）
- 提供面板重启 API（POST /api/settings/restart）
- 系统设置页面 UI：基本设置（端口、模式、域名）+ 安全设置（修改密码）
- proxy 模式下切换域名时自动更新 nginx 面板配置
- 修改 mode 或 port 后提示用户重启面板

**Non-Goals:**
- 不涉及 webhook/通知配置
- 不涉及日志查看/清理
- 不涉及系统级配置（主机名、时区等）
- 不涉及备份管理
- 不涉及多用户管理

## Decisions

### 1. 设置 API 单独路由而非复用 setup 路由
- **选择**: 新建 `src/routes/settings.js`，与 setup 路由分离
- **理由**: setup 是首次初始化的一次性流程，settings 是已初始化后的日常运维操作，职责不同。分离后各自逻辑更清晰，鉴权方式也不同（setup 用 token，settings 用 JWT）

### 2. 密码修改单独处理（不返回密码 hash）
- **选择**: GET /api/settings 只返回 port、mode、domain 等非敏感字段，不返回 passwordHash。PUT 时如果传了 password 字段则进行 bcrypt 哈希更新
- **理由**: 避免密码 hash 暴露给前端

### 3. 模式切换由后端逻辑判断
- **选择**: 后端处理模式切换的连带逻辑。standalone → proxy 时生成 nginx 面板配置；proxy → standalone 时不做特殊处理（保留 nginx 配置但不强制删除）
- **理由**: nginx 配置管理逻辑已封装在 nginx service 中

### 4. 重启通过 systemctl 命令实现
- **选择**: 后端通过 `execSync('systemctl restart worm-panel')` 或直接 `process.exit(0)` 由 systemd 自动重启
- **理由**: 简单直接，与现有安装方式一致。收到重启请求后返回成功响应，然后异步重启

### 5. 前端表单校验
- **选择**: 端口范围校验（1024-65535），密码一致性校验，模式切换时 domain 必填校验
- **理由**: 减少无效请求发送到后端

## Risks / Trade-offs

- **[重启中断]** 点击重启后面板会短暂不可用 → 前端提示用户约 3-5 秒后刷新页面
- **[模式切换后失联]** standalone → proxy 模式后面板监听地址变为 127.0.0.1，如果 nginx 未正确配置会导致无法访问 → 修改前提示用户确认 nginx 已安装且域名已解析
- **[无事务保护]** 配置写入是单文件操作，写入过程中崩溃可能损坏 config.json → 写入频率低，风险可接受
