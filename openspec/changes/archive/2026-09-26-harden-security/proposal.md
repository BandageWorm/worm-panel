# Proposal

## Why

面板多处入口直接把用户提供的字符串拼进 shell 命令或文件路径，存在可被利用的注入与路径穿越风险：写 crontab 用 `echo "..." | crontab -` 且只转义双引号（反引号、`$(...)` 会在写入时被执行）；文件上传直接使用 `req.file.originalname` 拼路径；备份盘的上传文件名与重命名新名未做净化。这是当前唯一"真实可被利用"的问题类别，且修复面清晰、边界明确。

## What Changes

- 写 crontab 不再经过 shell：改为先写临时文件，再执行 `crontab <file>`，消除 `echo` 字符串拼接与转义遗漏。
- 文件上传对 `req.file.originalname` 做净化：取 basename、拒绝空名与含 `..`/路径分隔符的名字；写入前校验最终路径未逃逸目标目录。
- 备份盘（drive）的上传文件名与重命名新名做同样的净化与逃逸校验。
- 清理 `src/routes/settings.js` 中未使用的 `execSync` 死导入。

**边界（不做什么）：**

- 不改变 cron 任务执行能力的语义：面板本身以 root 运行、设计上即具备命令执行能力，本变更只修注入，不加白名单、不加二次确认。
- 不引入沙箱，不重写文件管理器的全盘访问策略（面板定位如此）。
- 不改动认证、JWT、CORS、登录限流等其它安全面（另行讨论）。

## Capabilities

### New Capabilities

<!-- 无：本变更为既有模块的输入净化加固，不引入新能力 -->

### Modified Capabilities

- `cron`: 新增"写入 crontab 时不解释任务内容中的 shell 展开"的行为约束（写入机制变更，用户可见行为不变）。
- `file-browser`: 新增上传文件名净化与目标路径逃逸拒绝的要求。
- `backup-drive`: 新增上传文件名与重命名新名净化、路径逃逸拒绝的要求。

## Impact

- `src/services/cron.js`：`writeCrontab` 实现对 crontab 的写入方式（当前在 `:67` 使用 `echo ... | crontab -`）。
- `src/routes/files.js`：上传目标路径构造（当前 `:46-57`）与硬编码的 `/tmp/worm-upload/`。
- `src/services/files.js`：复用 `safeResolve` 或新增文件名净化工具函数。
- `src/routes/drive.js`：上传文件名使用处（当前 `:22-31`）与重命名路径构造（当前 `:187-201`）。
- `src/routes/settings.js`：移除未使用的 `execSync` 导入。
- 依赖：无新增第三方依赖。
- 数据/运行时：无格式变更；已有直链、备份盘文件不受影响。
