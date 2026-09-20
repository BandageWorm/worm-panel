# Tasks

## 1. 后端 service 层 — 纯 fs 操作

- [x] 1.1 在 `src/services/files.js` 实现 `rename(path, newName)`：校验 newName（非空、无 `/`/`\`/`..`），safeResolve 原路径与目标路径，目标已存在则报错，用 `fs.renameSync`。验证：Node REPL 或临时脚本对测试目录重命名成功、非法 newName 报错、目标已存在报错。
- [x] 1.2 实现 `move(src, dest)`：safeResolve 两端，dest 为目录时目标=dest/basename(src)，目标已存在报错，`fs.renameSync`；捕获 EXDEV 时降级为 cpSync+rmSync。验证：同盘移动、跨挂载点移动、目标冲突三种情况手动验证。
- [x] 1.3 实现 `copy(src, dest)`：safeResolve，`fs.cpSync(src,dest,{recursive:true,errorOnExist:true,force:false})`。验证：复制单文件、复制非空目录、目标冲突各验证一次。
- [x] 1.4 实现 `newFile(path)`：safeResolve，父目录不存在报错，`fs.writeFileSync(path,'',{flag:'wx'})` 保证不覆盖。验证：新建成功、已存在报错、父目录缺失报错。
- [x] 1.5 扩展 `deleteItem(path, recursive)`：非空目录仅在 recursive=true 时 `fs.rmSync(recursive:true)`，否则维持"目录不为空"报错；空目录与文件行为不变。验证：删文件、删空目录、删非空目录（recursive 开/关）四种情况。

## 2. 后端 service 层 — exec + sudo 操作

- [x] 2.1 在 `src/services/files.js` 增加内部 `sysExec(cmd, args, opts)` 帮助函数：先 execFile 当前身份运行，遇权限错误自动 sudo 重试一次（参照 firewall.js 的 ufwExec）。验证：对无权限路径 chmod 触发 sudo 分支，普通路径直接成功。
- [x] 2.2 实现 `chmod(path, mode)`：校验 mode 为合法三/四位八进制，safeResolve，路径不存在报 404 语义错误，调用 `sysExec('chmod',[mode,path])`。验证：合法权限修改成功、非法 mode 报错、无权限路径经 sudo 成功。
- [x] 2.3 实现 `extract(path, dest)`：按扩展名映射 tar/unzip 命令，先 `which` 检测命令存在，dest 默认压缩包所在目录，safeResolve 两端，用 execFile 参数数组执行。验证：解 tar.gz/zip 各一次、不支持格式报错、缺命令报错。
- [x] 2.4 实现 `compress(path, format, dest)`：format 限 tar.gz/zip，源不存在报 404，用 execFile 的 cwd 指定源父目录执行 tar/zip，返回生成的包路径。验证：压缩文件与目录各一次、非法 format 报错、源不存在报错。

## 3. 后端 service 层 — 批量操作

- [x] 3.1 实现 `batchDelete(paths)`：逐项调用删除（目录递归），单项失败不中断，返回 `[{path,success,error?}]`。验证：混合存在/不存在路径的数组，返回结果正确标注每项成败。
- [x] 3.2 实现 `batchMove(paths, dest)`：dest 不存在或非目录报 400，逐项移动到 dest 下，返回逐项结果。验证：批量移动含冲突项的数组，成败逐项正确。

## 4. 后端路由层

- [x] 4.1 在 `src/routes/files.js` 新增 POST `/rename`、`/move`、`/copy`、`/newfile`，接 body 参数并调用 service，统一错误状态码（404/400）。验证：用 curl/REST 客户端对每个端点跑通成功与错误路径。
- [x] 4.2 新增 POST `/extract`、`/compress`、`/chmod` 路由，接 body 调用 service。验证：curl 对每个端点验证成功与典型错误。
- [x] 4.3 新增 POST `/batch-delete`、`/batch-move` 路由，返回逐项结果数组；扩展 DELETE `/` 接收 recursive 查询参数透传给 deleteItem。验证：curl 验证批量端点与带 recursive 的删除。

## 5. 前端 FileBrowser 组件 — 操作入口

- [x] 5.1 在 `client/src/components/FileBrowser.vue` 文件行操作列增加重命名、移动、复制、压缩、权限入口（下拉或按钮），各自弹窗与 API 调用，成功后刷新列表。验证：浏览器中对文件/目录逐个操作，列表正确刷新。
- [x] 5.2 工具栏增加"新建文件"按钮及弹窗；删除非空目录时弹二次确认并带 recursive 调用。验证：新建空文件成功；删除非空目录时确认框出现且确认后删除成功。
- [x] 5.3 压缩包文件行增加"解压"入口（弹窗可选目标目录），权限列改为可点击编辑（chmod 弹窗，提交后刷新权限展示）。验证：解压压缩包成功；修改权限后列表权限列更新。

## 6. 前端 FileBrowser 组件 — 批量与搜索

- [x] 6.1 表格增加多选列与批量操作栏（批量删除、批量移动），批量删除弹二次确认，调用批量 API 并按返回结果提示失败项。验证：多选后批量删除/移动，失败项被提示。
- [x] 6.2 工具栏增加文件名搜索框，前端按关键字过滤当前目录列表（目录仍排在文件前）。验证：输入关键字后列表仅显示匹配项，清空后恢复。
- [x] 6.3 检查新增 UI 在 ≤768px 移动端布局（操作入口收拢、弹窗宽度自适应），不使用 Courier New 字体。验证：浏览器窄屏模式下各操作入口与弹窗可正常使用。

## 7. 联调与构建验证

- [x] 7.1 在 WSL2 中 `node app.js` 启动，Windows 浏览器访问 `http://wsl.localhost:4567`，端到端跑通全部新操作（含权限、解压、批量）。验证：所有 specs 场景在真实环境逐条走通。
- [x] 7.2 `cd client && npm run build` 重新构建前端产物，确认构建无错误、面板加载新 UI。验证：构建成功且刷新后面板显示新功能。
