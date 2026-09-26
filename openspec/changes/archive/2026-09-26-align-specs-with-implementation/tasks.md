# Tasks

## 1. 主规格结构修复（A）

- [x] 1.1 为 14 个缺失 Purpose 的主规格补 `## Purpose`（一到两句），逐个验证 `openspec show <id> --type spec --json` 不再报 `Spec must have a Purpose section`（实际待修为 14 个：17 个规格中 `systemd-manager`/`direct-link-download` 结构已正确，`workers` 由 4.1 删除）
- [x] 1.2 将 12 个规格的 `## 新增需求`/`## 用途` 改为 `## Purpose` + `## Requirements`（`cron`/`firewall` 无节标题需插入），需求/场景标题关键词改为 `### Requirement:` / `#### Scenario:`，验证 16 个存活规格 `openspec show` 全部成功且需求条数与实际一致

## 2. 代码补齐（B-代码）

- [x] 2.1 `src/routes/settings.js` 补上"切 proxy 但无域名"的校验分支，验证该场景返回校验错误且不写入 config
- [x] 2.2 `src/routes/ssl.js` + `src/services/acme.js`：状态接口返回 acme.sh 版本号、删除不存在证书返回 404，验证两个场景
- [x] 2.3 `src/services/pm2.js`：保存 ecosystem 配置后触发 reload（无进程时安全跳过），验证保存后进程状态发生变化
- [x] 2.4 `src/services/files.js`：读取非 UTF-8 文件返回 400 并提示"不支持的文件编码"，验证该场景

## 3. 规格内容修正（B-delta 校验）

- [x] 3.1 结构修复完成后核对 `sync`/`cron`/`panel-init` 的 requirement 标题，确认 delta 的 MODIFIED 标题逐字匹配
- [x] 3.2 确认 `client/src/layouts/MainLayout.vue` 的导航菜单与修正后的 `panel-init` 描述一致（不含 Workers 项）

## 4. 遗留与文档清理（C）

- [x] 4.1 删除 `openspec/specs/workers/` 目录，验证 `openspec list --specs` 不再列出 workers
- [x] 4.2 更新 `AGENTS.md`（模块表、部署流程、目录结构去掉 Workers、`ecosystem.config.js`、`data/workers/`）与 `README.md`，验证描述与仓库现状一致
- [x] 4.3 更新 `openspec/config.yaml` 的 context 模块清单（去掉 Workers），验证 YAML 可解析

## 5. 集成校验

- [x] 5.1 运行 `openspec validate` 覆盖全部变更与 16 个存活规格，确认无错误
- [x] 5.2 验证 ssl 状态/删除、pm2 保存配置、settings 切换 proxy 无域名、非 UTF-8 读取四处行为符合修正后的规格（验证环境改为目标服务器 root@38.47.114.109，经 `scripts/auto-deploy.sh` 部署后在运行目录 /opt/worm-panel 直接校验模块，8 项全部 PASS）
