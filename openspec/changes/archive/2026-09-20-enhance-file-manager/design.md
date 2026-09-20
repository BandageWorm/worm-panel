# Design

## Context

见 proposal.md - Why。现有 `src/services/files.js` 用 Node `fs` 同步 API 实现所有操作，以面板进程身份运行，无 sudo 提权。所有路径经 `safeResolve()` 做绝对路径校验和敏感路径（`/proc`、`/sys`、`/dev`）拦截。同项目的 `firewall.js`、`nginx.js` 已有成熟的 `execFile + 权限不足自动 sudo 重试` 模式可复用。本次在既有 `file-browser` 能力上扩展新增操作，不引入新页面、不改认证与路由挂载方式。

## Goals / Non-Goals

**Goals:**
- 补齐重命名、移动、复制、新建文件、递归删除等纯 `fs` 可完成的操作。
- 补齐解压/压缩、chmod 等需要系统命令的操作，复用现有 sudo 重试模式。
- 所有新操作沿用 `safeResolve()` 的路径安全边界；exec 类操作用 `execFile`（参数数组）避免命令注入。
- 前端在现有 `FileBrowser.vue` 上扩展，不新增路由页面。

**Non-Goals:**
- 不做全文内容搜索、回收站、文件共享/直链（已有独立模块）、跨主机传输、符号链接高级管理。
- 不追求覆盖式写入语义：所有创建/移动/复制默认**不覆盖**已有目标，冲突即报错，交由用户显式处理。
- 不做上传大小/分片改造（本次不涉及上传逻辑）。

## Decisions

### 决策 1：操作按"能否纯 fs 完成"划分实现方式

- **纯 fs 实现**（无需系统命令）：重命名、移动、复制、新建空文件、递归删除。
  - 重命名/移动：`fs.renameSync`。跨设备（EXDEV，如从磁盘移到 tmpfs 挂载点）时降级为"复制 + 删除源"。
  - 复制：`fs.cpSync(src, dest, { recursive: true, errorOnExist: true, force: false })`（Node 16.7+ 提供）。
  - 递归删除：`fs.rmSync(path, { recursive: true, force: false })`。
  - 新建空文件：`fs.writeFileSync(path, '', { flag: 'wx' })`（`wx` 保证不覆盖已存在文件）。
- **exec + sudo 实现**（依赖系统能力）：解压、压缩、chmod。
  - 理由：解压/压缩若用纯 JS 库需引入 `tar`/`adm-zip` 等 npm 依赖，与项目"尽量复用系统能力、少加依赖"的取向不符；且系统 `tar`/`unzip`/`zip` 对大文件和各种格式更稳。chmod 在面板非 root 运行时对 `/etc` 等路径会失败，需要 sudo 兜底。
- **备选**：全部走 exec（统一路径）。否决——重命名/移动/复制/删除用 `fs` 更快、更可控、错误信息更清晰，无谓 fork 进程和 sudo 提权是安全与性能的双重浪费。

### 决策 2：exec 类操作复用 firewall/nginx 的 sudo 重试模式

- 抽出一个内部帮助函数：先以当前身份 `execFile` 运行；若因权限（EACCES / `Permission denied`）失败，则自动以 `sudo` 重试一次。与 `firewall.js` 的 `ufwExec` 行为一致，保持代码风格统一，兼容 WSL2 开发环境。
- 命令一律用 `execFile('cmd', [args...])` 形式，参数以数组传入，**绝不拼接 shell 字符串**，杜绝路径中的特殊字符导致命令注入。

### 决策 3：解压/压缩的命令与格式映射

| 操作 | 格式 | 命令 |
|------|------|------|
| 解压 | `.tar` | `tar -xf <pkg> -C <dest>` |
| 解压 | `.tar.gz` / `.tgz` | `tar -xzf <pkg> -C <dest>` |
| 解压 | `.zip` | `unzip -o <pkg> -d <dest>` |
| 压缩 | `tar.gz` | `tar -czf <out> -C <parent> <name>` |
| 压缩 | `zip` | `zip -r <out> <name>`（在源父目录下执行） |

- 执行前用 `which <cmd>` 检测命令是否存在，缺失时返回明确错误（如"unzip 未安装"），不静默失败。
- 解压目标目录默认为压缩包所在目录；压缩输出默认写到源同级目录，文件名由源名 + 格式后缀生成。

### 决策 4：批量操作的错误语义为"逐项独立、部分成功"

- `batch-delete` / `batch-move` 对每一项独立执行，单项失败不中断整体，返回 `[{ path, success, error? }]` 数组。
- 理由：批量场景下"一项失败全部回滚"既难实现（跨多次文件系统操作无事务）又不符合直觉；逐项报告成败让用户清楚知道哪些没成功。前端据此高亮失败项。

### 决策 5：递归删除是行为扩展，前端强制二次确认

- 后端 `DELETE /api/files` 新增 `recursive` 标志：非空目录仅在 `recursive=true` 时递归删除，否则维持"目录不为空"报错，保证对旧调用方兼容。
- 前端删除非空目录时弹出二次确认，确认后才带 `recursive=true` 请求，避免误删整目录。

### 决策 6：路径安全统一走 safeResolve，多路径参数逐一校验

- 所有新增的 `path`/`src`/`dest`/`newName` 拼成的最终路径都经 `safeResolve()`。
- `newName` 额外校验：非空、不含 `/` 或 `\`、不含 `..`，防止借重命名做路径穿越。
- `dest` 为目录时，目标路径 = `dest/basename(src)`；`dest` 已含文件名时直接用，两种都要 resolve 后再校验。

## Risks / Trade-offs

- [`fs.cpSync`/`fs.rmSync` 需要 Node 16.7+/14.14+] → 项目安装脚本使用 Node 20.x，满足；design 记录该下限，避免低版本环境误用。
- [exec 解压/压缩以 sudo 运行时，解出的文件属主可能为 root] → 属于系统级操作的固有代价；在文档说明，必要时后续可加 `chown` 跟进，本次不做。
- [zip 压缩需切换工作目录以保证包内相对路径正确] → 用 `execFile` 的 `cwd` 选项指定源父目录，不用 `cd` 拼接命令。
- [跨设备移动降级为复制+删除，非原子] → 中途失败可能留下部分复制内容；先复制成功再删源，失败时保留源并报错，不至于丢数据。
- [批量操作无事务] → 已在决策 4 明确为"部分成功"语义，前端如实反馈，不假装原子。
- [解压 zip 炸弹/超大包] → 本次不做大小限额，属自用面板可接受范围；proposal 已将其列入非目标之外的已知限制。

## Open Questions

无。fs/exec 边界、覆盖策略、批量语义均已在决策中定明，不影响 specs 与任务拆分。
