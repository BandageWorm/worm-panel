# Design

## Context

动机见 `proposal.md` 的 Why。影响方案的现状约束：

- 工具要求主规格包含 `## Purpose` 与 `## Requirements` 两个节，才可能被解析；缺失时 `openspec show` 直接报 `Spec must have a Purpose section`。
- 可解析样本（`systemd-manager`、`direct-link-download`）证明：需求/场景标题关键词须为英文 `### Requirement:` / `#### Scenario:`，而名称与正文、场景内容可用中文。
- 13 个规格使用 `## 新增需求` + `### 需求：` + `#### 场景：` + `**当**/**则**` 结构，无法解析。
- MODIFIED delta 的标题需与主规格标题逐字（忽略空白）匹配，因此结构修复必须先于 delta 应用。

## Goals / Non-Goals

**Goals:**

- 17 个规格全部可被 `openspec show` 成功解析，需求条数与实际一致。
- 8 处内容漂移各自收敛到明确方向，spec 与实现不再互相矛盾。
- 文档不再描述已删除的模块或并不存在的文件。

**Non-Goals:**

- 不改变任何需求的业务语义（除明确认定为漂移的条目）。
- 不重写规格正文措辞，不做文风统一。
- 不引入新的规格治理流程或工具链改造。

## Decisions

### 1. 统一为"英文关键词 + 中文内容"

需求/场景标题使用英文关键词，名称、正文、WHEN/THEN 内容用中文。

- 备选：改造工具或 schema 以接受中文关键词。放弃原因：不动工具链，且已有两个规格证明当前格式可用。

### 2. 结构修复直接编辑主规格，不走 delta

依据 artifact 指令，修改既有能力的 Purpose 采用直接编辑主规格；节标题与关键词属格式而非需求语义，也不产生 delta。因此 A 层不进入 `specs/` 目录。

### 3. 漂移方向逐项判定

- 规格描述的是合理的、用户期望的正确/安全行为，而实现缺失 → **改代码**：`panel-settings`（proxy 无域名校验）、`ssl`（版本号、404）、`pm2`（保存后 reload）、`file-browser`（非 UTF-8 → 400）。
- 规格描述的场景在现有设计下不可达，或与既有设计取舍冲突 → **改规格**：`sync`（上限 50 → 20）、`cron`（非面板任务无 id，403 不可达 → 404）。
- 规格描述的是文档性清单 → **改规格**：`panel-init`（导航菜单、安装脚本）。

### 4. 执行顺序

A 结构修复 → B 内容对齐（代码改动 + delta 写入）→ C 清理。先修结构，delta 的 MODIFIED 标题才有可匹配对象。

### 5. `specs/workers/` 直接删除

该目录下全部需求均已标记为"已移除"，活跃需求为 0，删除不涉及 delta。

## Risks / Trade-offs

- [结构修复涉及 13 个文件、diff 较大，review 困难] → 与内容改动分开提交；结构修复只做标题与 Purpose 的机械改动。
- [MODIFIED 标题不匹配导致归档时丢内容] → 结构修复后先用 `openspec show` 确认标题，再写 delta；归档前运行 `openspec validate`。
- [把 bug 固化为规范] → 每项漂移在提案中已标注方向，评审时逐项确认。

## Migration Plan

- 无运行时数据迁移。建议提交顺序：结构修复 → 代码补齐 → delta → 文档清理。
- 回滚：全部为文本改动，按文件还原即可。
