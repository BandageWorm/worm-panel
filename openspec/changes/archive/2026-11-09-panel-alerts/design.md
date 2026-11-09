# Design

## Context

动机见 `proposal.md`。相关现状：

- 全局没有通知代码，`src/utils/logger.js` 只写 `console.error`，日志由 systemd 收集
- 潜在的事件源已经各自具备结构化结果：`sync.lastStatus` / `sync.lastSync`、cron 历史记录、`pm2.list()` 的 `status`、`nginx.validate()`、acme 列表的 `expireDate`
- `config.getSettings()` 与默认值合并的模式已经成熟，新增配置不会破坏老 `config.json`
- 凭据处理已有先例：云备份的 `webdavPass` 存盘但不通过接口回显，只返回 `connected` 布尔值
- 同类变更 `panel-observability` 提供指标采集快照（内存/磁盘/负载/流量配额），本变更的阈值规则优先消费它

## Goals / Non-Goals

**Goals:**

- 三种通道统一抽象，新增通道只需实现一个 transport 函数
- 规则判定与投递解耦：规则只产出事件，投递失败不影响判定
- 状态持久化，重启后不重复轰炸、不丢恢复通知
- 配置页即可完成全部操作，不需要改代码或文件

**Non-Goals:**

- 不做规则表达式编辑器、不做告警分级路由（按级别发不同通道）
- 不做面板自身宕机的 watchdog（需要独立 shell/timer，列为后续增强）
- 不做多用户订阅、不做告警静默时间窗（夜间免打扰）
- 不做投递结果的持久化重放（超出有限重试即放弃）

## Decisions

### 1. 通道抽象为 `send(payload)` 三个 transport

`notify.js` 对外只有 `send(payload)`，内部按启用的通道并发调用：

```
send({ level, rule, target, message, time })
  |-- telegram: https fetch  {apiBase}/bot{token}/sendMessage
  |-- email:    nodemailer   subject = `[worm-panel] ${rule} - ${target}`
  +-- webhook:  fetch(url, {method, headers, body: render(tpl)})
返回 Promise.allSettled 汇总为 [{channel, ok, ms, error}]
```

替代方案：为每种通道写独立模块文件。否决原因——三个通道各不到 60 行，拆文件反而要维护四份导出。

### 2. 邮件用 `nodemailer`，不用本机 MTA

理由：纯 JS、无原生编译、对 465/587 与自签证书的处理成熟。本机 `sendmail` 需要先装 Postfix，维护成本远高于一个依赖；手写 SMTP 客户端则要自己处理 TLS 升级、编码与分片，不值得。

### 3. 规则是代码内声明的表，用户只能改参数

规则结构固定为 `{id, kind: threshold|event, level, defaultThreshold, cooldown, evaluator}`。用户可改的只有 `enabled / threshold / cooldown`，存在 `config.alerts.rules[id]`。

替代方案：让用户自定义条件表达式。否决原因——需要解析器与沙箱，个人面板不需要；固定规则表已经覆盖全部真实场景。

### 4. 状态机与冷却键

```
        条件命中                 冷却期内重复命中
  ok ──────────────> firing ──(静默，仅更新 lastSeen)──┐
   ^                    │                              │
   └──── 恢复通知 ───────┘ <──── 条件回落 N 个周期 ──────┘
```

- 状态键 = `ruleId:target`，例如 `cert-expiry:example.com`、`pm2-error:worker-a`
- 恢复判定需要**连续 2 个采样周期**不再命中，避免抖动导致反复"告警-恢复"
- 恢复通知**不受冷却限制**（否则永远被压住），但每条状态只发一次恢复
- 状态持久化在 `data/alert-state.json`，`SIGTERM` 时同步落盘

替代方案：只存"最近发送时间"做去重。否决原因——无法区分"仍在告警"与"已恢复"，恢复通知就无从触发。

### 5. 事件型与阈值型走不同触发路径

- 阈值型：挂在 `panel-observability` 的采样 tick 上评估（每 5 秒，纯内存计算）
- 事件型：由各模块在关键失败点调用 `alerts.emit(ruleId, target, detail)`（备份失败、cron 非零退出、PM2 errored、证书临期）

事件型用 `ruleId:target:级别` 指纹去重，同一失败在冷却期内只报一次。

替代方案：事件型也轮询各自数据源。否决原因——备份失败与 cron 失败都是"一次性事件"，轮询会漏，且成本更高。

### 6. 不依赖采集器也能跑

若 `panel-observability` 尚未落地，阈值规则退化为在规则评估时现场调用 `monitor.js` 单点采集。这样两个变更可并行，不构成硬阻塞。

### 7. 消息体用纯文本，统一前缀

统一格式 `[worm-panel][WARN] 磁盘使用率 92%（阈值 90%） @ 2026-11-09 12:00`。不用 Markdown/HTML 解析模式，避免各通道转义规则不同导致内容错乱。

### 8. 凭据明文存盘，接口层脱敏

与 `webdavPass` 保持一致。面板本身具备 root 执行能力，把加密密钥放在同一块盘上不增加任何实际安全性，只会让排障变复杂。接口层只回 `configured: true`，写入时留空表示不修改。

### 9. 投递失败：一次重试 + 待发队列

即时重试一次（2 秒后），仍失败则进入 `data/alert-pending.json`，按 1 / 5 / 15 分钟退避重试，最多 3 次。放弃后写历史，标记失败。队列不跨重启无限堆积——启动时清理超过 24 小时的条目。

### 10. 调度不新增定时器

阈值评估复用采集 tick（5s），待发队列重试挂在同一 tick 上按到期时间检查。避免多个 `setInterval` 互相干扰。

## Risks / Trade-offs

- **依赖 `panel-observability` 的数据质量** → 已设计降级路径（现场采样），且阈值规则只读快照不写。
- **Telegram 在境内直连可能不通** → `apiBase` 可配；页面在"测试失败"时提示检查网络或配置反代地址，而不是只抛超时。
- **邮件被判为垃圾邮件** → 使用邮箱服务商的 SMTP 授权码而非登录密码；文档中建议使用带 SPF/DKIM 的发件域名。个人自用下这是可接受的不确定性。
- **告警风暴** → 三层防护：冷却、状态保持、恢复需连续 2 周期；最坏情况下同一规则每冷却期一条。
- **规则评估每 5 秒执行** → 全部为纯内存判断；只有证书/PM2 这类事件源依赖 `health` 的 60 秒缓存，不会打穿。
- **重启瞬间的告警丢失** → 落盘在 `SIGTERM` 同步执行；进程被 `kill -9` 时最多丢最近一个周期，可接受。
- **面板自身宕机无人告警** → 明确列为 Non-Goal，需要外部 `systemd timer` + `curl` 直发 webhook，待本变更稳定后单独立项。

## Migration Plan

1. `config.json` 新增 `alerts` 块；老配置缺失时按"全部通道未启用、规则默认开启"运行，不会突然开始发消息
2. 首次启动创建 `data/alerts.json`、`alert-state.json`（`alert-pending.json` 按需创建）
3. 依赖安装：`npm install nodemailer`，随部署脚本自动完成
4. 回滚：移除路由与引擎启动即可；`alerts` 配置块留在 `config.json` 中不影响旧逻辑
