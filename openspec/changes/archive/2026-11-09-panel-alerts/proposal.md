# Proposal

## Why

面板目前没有任何主动通知能力：磁盘写满、服务挂掉、证书到期、备份失败、定时任务失败，全都只能靠人登录面板才能发现。对一个不是天天打开的私人面板来说，这是最大的隐性成本——出事时它不会告诉你。

## What Changes

- 新增通知通道层 `services/notify.js`，支持三种通道并行发送：
  - Telegram Bot（零依赖，支持自定义 `apiBase` 以适配反代）
  - 邮件（`nodemailer` + SMTP，端口限定 465/587）
  - 通用 webhook（自定义 URL / method / headers / body 模板，内置 Bark、Server 酱、企业微信、钉钉预设）
- 新增规则引擎 `services/alerts.js`：开关 + 阈值 + 冷却期三档可配，覆盖磁盘、内存、负载、月流量、证书到期、服务异常、备份失败、定时任务失败
- 通知带上**恢复通知**：告警从 firing 转为 ok 时补发一条，避免"只知道出事、不知道已修好"
- 发送失败重试一次，仍失败进入待发队列等待下一采集周期补发，不静默丢弃
- 新增告警历史 `data/alerts.json`（保留最近 200 条，含通道、耗时、错误原文）
- 新增页面 `/alerts`：通道配置（含测试发送）、规则清单、告警历史
- 敏感字段（botToken / SMTP 密码 / 含密钥的 webhook URL）只写不读，接口仅返回"已配置"标记

### 范围边界

- 做什么：通道配置与投递、规则判定、冷却与恢复、历史留存、配置界面
- 不做什么：不做 webhook 签名校验与复杂路由、不做告警分级静默窗口、不做多用户订阅、不在本变更内实现面板自身宕机的 watchdog 脚本（作为后续增强）

## Capabilities

### New Capabilities

- `alerting`: 通知通道（Telegram / 邮件 / webhook）的配置、测试与投递，告警规则判定、冷却与恢复通知、告警历史

### Modified Capabilities

（无）

## Impact

- 新增：`src/services/notify.js`、`src/services/alerts.js`、`src/routes/alerts.js`、`client/src/views/AlertManager.vue`
- 修改：`src/services/config.js`（`alerts` 配置块与默认值）、`src/index.js`（路由挂载、引擎启动）、`src/services/autosync.js` 与 `src/services/cron.js`（失败事件上报）、`client/src/router/index.js` 与 `client/src/layouts/MainLayout.vue`（菜单入口）
- 依赖：新增 `nodemailer`（纯 JS，无原生编译）
- 运行时数据：`data/alerts.json`、`data/alert-state.json`、`data/alert-pending.json`
- 配置：`config.json` 新增 `alerts.telegram` / `alerts.email` / `alerts.webhook` 与规则阈值
