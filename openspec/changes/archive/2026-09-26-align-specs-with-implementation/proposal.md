# Proposal

## Why

`openspec show` 对 13 个主规格直接报错 `Spec must have a Purpose section`——它们开头用的是 `## 新增需求`（那是 delta 的标题），缺少主规格必需的 `## Purpose` 与 `## Requirements`，导致规格库对工具整体不可读。与此同时盘点出 8 处 spec 与实现的内容不符，`specs/workers/` 已是 0 条活跃需求的空壳，而 `AGENTS.md`、`openspec/config.yaml` 仍在描述已被移除的 Workers 模块。规格一旦不可读、不可信，就不再能作为约束与验证依据。

## What Changes

分三层：

**A. 修复主规格结构（前置，命门）**

- 为 13 个无法解析的主规格补 `## Purpose`，并把 `## 新增需求` 改为 `## Requirements`。
- 统一需求/场景标题关键词为 `### Requirement:` / `#### Scenario:`（名称保持中文），正文与 WHEN/THEN 内容用中文。这是工具当前唯一验证通过的格式（参照 `systemd-manager`、`direct-link-download`）。
- 验收目标：`openspec show <spec>` 对 17 个规格全部成功解析。

**B. 内容对齐（逐项确定"以谁为准"）**

- **代码补齐**（spec 正确、实现缺失）：`panel-settings` 切 proxy 无域名时返回校验错误；`ssl` 状态返回 acme.sh 版本号、删除不存在证书返回 404；`pm2` 保存配置后自动 reload；`file-browser` 非 UTF-8 返回 400。
- **spec 修正**（实现为准）：`sync` 备份历史保留上限 50 → **20**，与实现及 `backup-drive` 统一；`cron` 编辑非面板任务的响应口径改为 404（非面板任务没有 id，原 403 场景不可达）；`panel-init` 导航菜单列表移除 Workers，安装脚本描述改为实际的 nvm Node 22 + 全局 pm2/wrangler/ws + rclone + aliyundrive-webdav。
- **无需变更**：`xui`（页面已不展示版本号，API 返回版本无副作用）。

**C. 遗留与文档清理**

- 删除 `openspec/specs/workers/` 空壳目录（其需求已全部标记为移除）。
- 更新 `AGENTS.md`、`openspec/config.yaml`、`README.md`，去掉 Workers 残余描述与并不存在的 `ecosystem.config.js`、`data/workers/`。

**边界（不做什么）：**

- 不新增任何功能，不扩大或缩小任何模块的能力范围。
- 不重写规格正文措辞，只修正确认为"漂移"的条目。
- 不做工程化改造（属 `add-quality-tooling`），不做前端体验改动（属 `polish-frontend-ux`）。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

- `sync`：备份历史保留上限由 50 修正为 20。
- `cron`：编辑非面板任务的响应口径修正为 404。
- `panel-init`：导航菜单项列表与安装脚本行为描述修正。

<!-- 说明：panel-settings / ssl / pm2 / file-browser 的差距方向是"代码补齐 spec"，主规格内容不变，因此不产生 delta；A 层的结构修复是对主规格的直接编辑，不是需求变更，也不产生 delta。 -->

## Impact

- 规格：`openspec/specs/` 下 13 个主规格的结构修复（直接编辑）；`sync`、`cron`、`panel-init` 的 delta 文件；`openspec/specs/workers/` 目录删除。
- 代码：`src/routes/settings.js`、`src/routes/ssl.js`、`src/services/acme.js`、`src/services/pm2.js`、`src/services/files.js`、`src/services/cron.js`、`client/src/layouts/MainLayout.vue`。
- 文档：`AGENTS.md`、`openspec/config.yaml`、`README.md`。
- 依赖：无新增依赖。
- 风险：结构修复会改动 13 个规格文件，diff 较大但为机械性改动；内容对齐需逐项确认方向，避免把 bug 固化成规范。
