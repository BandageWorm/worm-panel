# Tasks

## 1. 共享净化工具

- [x] 1.1 实现 `sanitizeFilename(name)` 与越界校验函数（置于 `src/services/files.js` 导出或新增 `src/utils/paths.js`），并手工验证 `../x`、`a/b.txt`、`''`、`'.'`、`'..'`、`'中文 名.txt'` 的返回符合 delta spec
- [x] 1.2 在说明中记录净化规则（拒绝路径语义字符、保留其余字符），并确认 files/drive 两处都将复用同一实现

## 2. cron 写入加固

- [x] 2.1 将 `src/services/cron.js` 的 crontab 写入改为"写临时文件 → `execFile('crontab', [tmpFile])`"，验证：命令含 `$(whoami)` 或反引号时，写入后 crontab 内容逐字保留且未执行子命令
- [x] 2.2 补全失败路径：写临时文件或导入失败时返回错误、清理临时文件、保持原有 crontab 不变，并验证该场景

## 3. 文件上传加固

- [x] 3.1 `src/routes/files.js` 上传改用净化后的文件名，验证 `../../etc/passwd` 与 `sub/dir/a.txt` 两种情况分别被拒绝 / 被净化为 `a.txt`
- [x] 3.2 将上传临时目录由硬编码 `/tmp/worm-upload/` 改为 `os.tmpdir()` 下的面板私有目录，验证正常上传成功、目标目录不存在时返回错误

## 4. 备份盘加固

- [x] 4.1 `src/routes/drive.js` 上传文件名净化，验证 `../escape.txt` 被拒绝且不触发 WebDAV 同步
- [x] 4.2 `src/routes/drive.js` 重命名新名净化，验证 `../../outside` 与空名被拒绝、文件保持原名

## 5. 集成验证与收尾

- [x] 5.1 移除 `src/routes/settings.js` 中未使用的 `execSync` 导入，验证服务可正常启动
- [x] 5.2 端到端验证 cron 新建/编辑/执行、文件上传、备份盘上传与重命名的正常路径与攻击路径（验证环境改为目标服务器 root@38.47.114.109 的运行目录 /opt/worm-panel；cron 部分用伪造的 crontab 命令拦截写入，未改动服务器真实 crontab；27 项检查全部 PASS，其中中文文件名乱码为改动前既有问题、仅记录）
