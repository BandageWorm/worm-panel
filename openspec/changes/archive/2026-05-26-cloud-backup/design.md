## Context

当前面板的笔记模块基于本地文件系统，数据存储在 data/notes/ 目录。服务器为临时租用实例，缺乏外部数据保护。需要将笔记数据备份到阿里云盘。

rclone 是成熟的云存储同步工具。但 rclone 的 Linux 静态构建未包含 aliyundrive 后端（CGO 依赖），因此改用双层架构：aliyundrive-webdav 作为代理层，rclone 通过 webdav 后端连接同步。

## Goals / Non-Goals

**Goals:**
- 新增阿里云盘连接管理功能（认证、断开、状态查询）
- 实现笔记数据到阿里云盘的单向同步备份
- 每次笔记保存后自动触发备份（异步，不阻塞用户编辑）
- 每 12 小时 cron 定时同步兜底
- 支持从云端恢复到本地（覆盖）
- 备份历史记录（成功/失败/文件数/大小）
- 安装脚本自动安装 rclone 并配置定时任务

**Non-Goals:**
- 不支持双向同步（也不需要在阿里云盘侧编辑）
- 不实现冲突检测或合并（单向覆盖）
- 不实现其他云盘提供商（当前仅阿里云盘）
- 不实现全量服务器数据灾备（当前仅 notes，后续可扩展）

## Decisions

### 1. 双层架构：aliyundrive-webdav + rclone webdav 后端

阿里云盘 → aliyundrive-webdav（本地代理）→ rclone webdav 后端同步。

**为什么？**
- rclone 官方 Linux 静态构建未包含 aliyundrive 后端（CGO 编译依赖）
- aliyundrive-webdav 是成熟的阿里云盘 WebDAV 网关，纯 Rust，维护活跃
- rclone 的 webdav 后端是标准内置后端，稳定可靠

### 2. 身份认证：QR 码扫码登录

aliyundrive-webdav v2+ 使用 QR 码登录。服务端运行 `aliyundrive-webdav qr login` 生成二维码，手机阿里云盘 App 扫码即完成授权，token 自动保存到本地。

**为什么？**
- 无需手动复制 refresh_token，用户体验好
- token 自动管理，到期自动刷新
- 适配无头服务器场景（SSH 终端显示 ASCII 二维码，手机扫码）

### 3. 通过 shell 调用 rclone，而非 node.js binding

rclone 是独立二进制，通过 `child_process.execFile` 调用。

**为什么？**
- rclone 本身无官方 Node.js SDK
- 命令行接口成熟稳定，解析 JSON output 即可
- 与面板现有的 acme.sh 调用模式一致

### 4. WebDAV 配置存储于 data/config.json

```json
{
  "sync": {
    "provider": "webdav",
    "webdavUrl": "http://localhost:8080",
    "webdavUser": "admin",
    "webdavPass": "<rclone obscured password>",
    "connectedAt": "...",
    "lastSync": "2026-05-26T10:30:00Z",
    "lastStatus": "ok",
    "history": [
      { "time": "2026-05-26T10:30:00Z", "status": "ok", "files": 4, "size": 2359296 }
    ]
  }
}
```

**为什么？**
- 与面板现有配置存储方式统一
- 无需新增数据库
- WebDAV 密码通过 `rclone obscure` 加密后存储

### 5. rclone config 以环境变量注入而非写入配置文件

不调用 `rclone config create`，而是通过 `RCLONE_CONFIG_*` 环境变量直传递配置，避免在服务器文件系统留下敏感信息。

**为什么？**
- 配置完全由面板管理，不依赖外部配置文件
- 每次调用时动态注入

### 6. 同步触发策略：保存触发 + 定时兜底

- **即时触发**: 笔记保存 API 返回后，异步 spawn rclone sync，不阻塞 HTTP 响应
- **定时兜底**: 面板内部 setInterval 每 12 小时执行一次
- 两者共存：即时触发覆盖大多数场景，定时兜底覆盖服务器重启等边界情况

### 7. 备份范围目录结构

远程路径结构（rclone 的 webdav remote）：
```
syncremote:worm-panel-backup/
  └── notes/
      ├── 笔记1.md
      ├── 笔记2.md
      └── ...
```

data/ 根级别作为备份根，子目录对应不同数据模块，便于后续扩展。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| rclone 未安装 | install.sh 自动安装，面板首次配置时检测并提示 |
| aliyundrive-webdav 未安装 | install.sh 自动安装 pip 包，面板检测并引导 |
| refresh_token 过期 | aliyundrive-webdav 启动日志会报错，重新运行 --get-token 获取 |
| aliyundrive-webdav 服务未运行 | 面板检测连通性失败时提示用户检查代理服务状态 |
| 同步过程中服务器宕机 | 幂等操作，下次同步自动覆盖；定时兜底保障 |
| 阿里云盘 API 限频 | 单用户笔记量级远低于限频阈值 |
