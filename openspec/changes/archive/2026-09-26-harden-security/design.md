# Design

## Context

动机见 `proposal.md` 的 Why。与实现相关的现状约束：

- 面板通常以 root 运行，`src/services/cron.js` 通过子进程写 crontab 并执行任务；`src/services/files.js` 已存在 `safeResolve`，但仅屏蔽 `/proc`、`/sys`、`/dev`，且上传路径根本没调用它。
- 当前 crontab 写入形如 `exec(\`echo "${content}" | crontab -\`, { shell: '/bin/bash' })`，转义只覆盖双引号。
- `src/routes/files.js` 使用 `path.join(destDir, req.file.originalname)` 且上传临时目录硬编码为 `/tmp/worm-upload/`。
- `src/routes/drive.js` 的 `relPath` 已走 `resolveSafePath`，但 `newName`（重命名）与 `file.originalname`（上传）未经净化。

## Goals / Non-Goals

**Goals:**

- 消除"用户字符串进入 shell 命令行"与"用户字符串进入文件路径"两类注入面。
- 复用/沉淀一个共享的文件名净化与路径越界校验工具，供 files 与 drive 共用。
- 保持所有既有用户可见行为不变（除攻击性输入被拒绝外）。

**Non-Goals:**

- 不改变 cron 任务执行能力语义（面板以 root 运行即具备命令执行能力，本变更只修注入）。
- 不引入沙箱、容器或 seccomp 类限制。
- 不重写文件管理器的全盘访问策略，不改动 `safeResolve` 的黑名单目录范围。
- 不改动认证、JWT、CORS、限流等其它安全面。

## Decisions

### 1. crontab 写入改为"临时文件 + crontab 程序读取"

先 `fs.writeFileSync(tmpFile, content)`，再以 `execFile('crontab', [tmpFile])`（数组传参、不经 shell）导入，`finally` 中删除临时文件。

- 备选：继续用 `echo` 并补全转义（反引号、`$`、换行、`\`）。放弃原因：转义规则在 `/bin/bash` 下语义复杂且易漏，任何一处遗漏即回到漏洞。
- 备选：`spawn` 后写 stdin。可行，但与既有 `execFile` 风格不一致；临时文件方案更易复用现有互斥锁与错误处理。

### 2. 沉淀共享净化工具

在 `src/services/files.js` 导出（或新增 `src/utils/paths.js`）：

- `sanitizeFilename(name)`：取 `path.basename(name)`；若结果为 `''`、`.`、`..` 则抛校验错误；拒绝含 `\0` 的名字。
- `assertInside(baseDir, targetPath)`：`path.resolve` 两者后校验 `target === base` 或以 `base + path.sep` 开头。

- 备选：在两个路由里各写一份。放弃原因：会重复且容易只修一处。
- 字符策略：只拒绝路径语义相关字符（分隔符、`..`、空、NUL），其余（中文、空格、括号等）保留，避免过度收紧。

### 3. 上传临时目录不再硬编码

`multer` 的 `dest` 改为基于 `os.tmpdir()` 的面板私有子目录（并在启动时确保存在），避免固定路径带来的权限/并发冲突。

### 4. 死代码清理

移除 `src/routes/settings.js` 中未使用的 `child_process.execSync` 导入。

## Risks / Trade-offs

- [净化过严导致合法文件名被拒] → 只拒绝路径语义字符，中文/空格/常见符号保留；spec 已列出被拒的具体场景。
- [crontab 临时文件残留] → `finally` 中删除；失败路径同样清理。
- [行为变化：带目录前缀的"文件名"由被接受变为被净化] → 属预期修复，已在 delta spec 中定义为可验证场景。
- [drive 与 files 净化实现分叉] → 通过共享工具函数消除该风险。

## Migration Plan

- 无数据格式变更，无需迁移。
- 部署：常规 `bash scripts/sync-and-deploy.sh`。
- 回滚：还原所改动的源文件即可，无残留状态。
