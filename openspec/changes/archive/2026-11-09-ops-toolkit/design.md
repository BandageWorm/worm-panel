# Design

## Context

动机见 `proposal.md`。相关现状：

- `gitworker` 的后端、路由（`/api/gitworker`）与规格都已存在，但 `client/src` 中没有任何页面或菜单项引用它，属于"只有接口没有入口"
- 现有规格把入口描述为"PM2 页面内的按钮"，实际实现没有该按钮，需要在本次一并修正
- `src/services/pm2.js` 已有 `getLogs(name, lines)` 与 `list()`；`src/services/systemd.js` 已有 `getServiceLogs(name, lines)` 的 journald 用法；`src/services/firewall.js` 已有 ufw 规则列表能力——三者都可复用，不必重写
- 面板以 systemd / root 运行，`ss`、`ps`、`journalctl` 均可用；nginx 日志位于 `/var/log/nginx/`，PM2 日志位于 `~/.pm2/logs`
- 侧边栏当前已有 14 个菜单项，本次再增 3 项，需要一次信息架构调整

## Goals / Non-Goals

**Goals:**

- 三个工具都做到"打开即用、无需配置"
- 危险动作（终止进程）有明确边界，不会误伤关键服务
- 日志读取在任意文件体积下都有稳定响应，且不会变成任意文件读取漏洞

**Non-Goals:**

- 不做 Docker / 容器维度的端口与进程视图
- 不做日志全文索引、归档、或跨天查询（只读尾部）
- 不做端口监听变化的告警（属于 `panel-alerts` 的扩展话题）
- 不把 GitWorker 改成异步任务队列 + 实时日志流

## Decisions

### 1. 端口解析用 `ss -H -tulpn`，不引第三方库

`ss` 输出结构稳定，用 `-H` 去掉表头、`-p` 带进程信息。解析时按列切分，`users:(("nginx",pid=123,fd=6),("nginx",pid=124,fd=6))` 解析为进程数组，一个端口可能对应多个 pid。

替代方案：`lsof -i -P -n`。否决原因——慢（全进程扫描）、可能未安装、输出更啰嗦；`netstat` 在新发行版已弃用。

替代方案：引入 `ps-list` 之类 npm 包。否决原因——它不做端口，且只省下几十行解析代码。

### 2. 进程列表用 `ps -eo`，条数受限

固定列：`pid,ppid,user,pcpu,pmem,rss,etime,args`，`--sort=-pcpu` 或 `--sort=-pmem`，返回条数默认 50、上限 500。命令行超过阈值截断，完整内容随行返回。

替代方案：读 `/proc/*/stat` 自行计算。否决原因——要自己处理 ticks、页大小、单位换算，`ps` 已经做好且口径与用户直觉一致。

### 3. 终止进程：白名单式保护 + 默认 SIGTERM

保护判定同时看 pid 与进程名：

```
拒绝终止：pid 1 / systemd
          pid == process.pid（面板自身）
          进程名 sshd
          nginx master（与 /run/nginx.pid 或 ss 中 root 属主的 nginx 主进程匹配）
```

默认发送 `SIGTERM`，需要 `SIGKILL` 时由用户显式选择。前端对受保护进程不渲染终止按钮，后端二次校验（前端保护只是体验，后端才是边界）。

替代方案：只在前端隐藏按钮。否决原因——API 直接被调用时就没有防线了。

### 4. 交叉引用各自复用现有服务，并加轻量缓存

- 面板自身端口：直接读 `config.load().port` 与 `server.address()`
- Nginx 站点：复用 `services/nginx.js` 读取站点配置，用正则取 `listen` 端口
- PM2 项目：`pm2.list()` 有连接开销，结果缓存 30 秒
- 防火墙：复用 `services/firewall.js` 已解析的 ufw 规则

### 5. 日志源是"注册表 + 解析器"，不接受任意路径

```
{ id: 'nginx', label: 'Nginx', type: 'file',
  roots: ['/var/log/nginx'],          // 允许的根目录
  discover(): 扫描 sites-enabled / conf.d 中的 access_log / error_log }
{ id: 'pm2',   type: 'file', roots: [~/.pm2/logs, data/logs] }
{ id: 'panel', type: 'journal', unit: 'worm-panel' }
{ id: 'system',type: 'journal', unit: null }
{ id: 'cron',  type: 'structured', source: cron 历史 }
```

客户端只传 `sourceId` 与 `fileId`，**永远不传路径**。服务端把 `fileId` 映射回注册表里发现的真实路径，并校验其落在允许根目录内。这是本模块唯一的安全边界，必须写死。

替代方案：直接接受 `path` 参数 + 白名单校验。否决原因——白名单字符串前缀匹配容易出绕过（`/var/log/nginx/../../etc/shadow`），而"只接受 id"从根上避免了这个问题。

### 6. 尾部读取按块倒着读，不 readFileSync

```
stat → size
start = size - 64KB
循环：createReadStream(start, min(start+64KB, size)) 累积内容
      按 \n 切分，够 N 行即停止
      start -= 64KB，直到 start <= 0
```

这样 2GB 的 access.log 与 2KB 的 error.log 响应时间同量级。

替代方案：先 `execFile('tail', ['-n', N, path])`。更简单也更稳，但仍要自己做路径校验；两者择一。**最终选择 `tail`**：实现更短、行为与用户在终端里的预期完全一致、不需要处理编码边界；仅对 journal 类型改用 `journalctl`。上述倒读方案作为 `tail` 不可用时的降级路径。

### 7. 自动刷新用轮询，不用 SSE / WebSocket

间隔默认 3 秒，可关闭。日志量小、实现简单、断线自恢复，且不会像 WebSocket 那样在服务重启时留下僵尸连接。

替代方案：SSE 推送。否决原因——需要在服务端维持 tail 进程，一个页面一个进程，对个人面板是过度设计。

### 8. GitWorker 保持同步部署，前端用长超时 + 阶段文案

后端 `deploy()` 是同步阻塞（clone + install + pm2 start，最长 120 秒）。前端请求超时设为 150 秒，提交后按钮进入 loading 并按时间推进显示"克隆仓库 → 安装依赖 → 启动进程"，完成后刷新列表。

部署入口留在 PM2 页面内（不新增独立页面）：该页已有"从 GitHub 部署常规项目"按钮，把 Worker 部署放在同一工具栏里，用户不必在两处之间切换。

替代方案：改成任务队列 + SSE 进度。否决原因——需要任务表、状态机与断线重连，收益仅是"进度更真实"；当前规模下不值得。失败时后端已有清理目录的逻辑，前端直接展示错误原因即可。

### 9. 项目列表与 PM2 状态合并

一次 `pm2.list()` 取全量，按 `name` 与 `workers.json` 的记录 join。PM2 查询失败时降级：列表照常返回，状态标记为"未知"，不使整个接口 500。

### 10. 导航保持平铺

侧边栏不引入分组，只在末尾追加「告警」「端口与进程」「日志中心」三项；Worker 部署不占菜单位置，作为 PM2 页面内的操作入口。

替代方案：按「主机 / 服务 / 运维工具」分组。否决原因——分组会让同类功能被折叠标题割裂，且现有 14 项本身已在可滚动范围内；保持平铺更符合当前的使用习惯。

端口与进程合并为同一个页面内的两个标签页，避免菜单继续膨胀。

## Risks / Trade-offs

- **`ss -p` 在受限权限下拿不到进程信息** → 面板以 root 运行，正常情况下可用；解析失败时降级为"进程未知"而不是接口报错。
- **`ss` / `ps` 输出格式随发行版差异** → 使用 `-H` 无表头输出并按列定位，解析失败保留原始行并标记异常，便于排查。
- **误杀进程导致服务中断** → 保护清单在服务端硬校验；默认 `SIGTERM` 而非 `-9`；二次确认弹窗展示进程名与命令行。
- **日志读取成为任意文件读取入口** → 只接受 `sourceId`，路径由服务端注册表决定并校验根目录。
- **PM2 查询拖慢页面** → 30 秒缓存；端口页与进程页的轮询间隔不短于 3 秒。
- **GitWorker 部署超时后后端仍在跑** → 前端超时仅影响展示，后端 continue 至完成或自身超时；页面刷新后以项目列表为准。后续若确有需要再引入任务队列。
- **`journalctl` 在无 systemd 环境不可用** → 该源标记为不可用，其它源正常。

## Migration Plan

1. 无数据迁移，新增路由与页面即可；`/api/gitworker` 已存在，仅新增前端调用
2. 回滚：移除 `routes/ports.js`、`routes/logs.js` 的挂载与两个前端路由，其余模块不受影响
3. 菜单为纯前端改动，回滚时移除新增的两项即可
