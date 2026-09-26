# Design

## Context

动机见 `proposal.md` 的 Why。影响方案的现状约束：

- 现有后端为 CommonJS（`require`），入口 `app.js`，业务逻辑集中在 `src/services/*.js`，路由在 `src/routes/*.js`。
- 前端独立 `client/` 目录，Vite 构建产物输出到仓库根 `public/`。
- 项目约定开发/测试在 WSL2 Ubuntu 进行，不在 Windows 原生环境运行。
- 众多服务函数依赖真实系统命令（nginx、pm2、ufw、acme.sh、systemctl），无法在无服务器环境直接测试。

## Goals / Non-Goals

**Goals:**

- 建立可运行的测试骨架，让"纯逻辑"部分可被自动验证。
- 建立 lint/format 基线，提供统一的 `npm run lint` / `npm run format`。
- 提供最小 CI，至少覆盖 lint 与测试。

**Non-Goals:**

- 不追求覆盖率指标或强制门禁。
- 不测试依赖真实系统命令的路径（属集成范畴）。
- 不引入 TypeScript，不重构既有代码结构，不改变产品行为。

## Decisions

### 1. 测试框架选 vitest

- 备选：jest。放弃原因：vitest 原生 ESM/TS 友好，后续可无缝覆盖 `client/` 的 Vue 组件，避免引入两套工具链。
- 备选：Node 内置 `node:test`。放弃原因：生态与 Vue 支持较弱，后续扩展成本高。

### 2. 只测"纯逻辑"，不 mock 整条系统命令链

优先覆盖不依赖外部环境的部分：文件名净化与路径校验、crontab 文本解析/拼接、配置读写、历史记录截断等。

- 对这些函数做无副作用拆分（纯函数化）是测试的前提；如遇强耦合，仅做最小抽取，不做大重构。

### 3. ESLint 以"不引入大量改动"的宽松规则起步

先启用语法/错误类规则，暂不启用会引发全仓库重排的风格规则。

### 4. Prettier 与全量格式化分离

- 若全量格式化会产生大量 diff，则本变更只落地配置文件与脚本，不执行全量重排；重排如需进行，应作为独立的格式化提交。

### 5. CI 只跑 lint + 测试

- 不构建前端产物（构建依赖 `client/npm install`，耗时且与本变更目标无关），需要时可后续扩展。

## Risks / Trade-offs

- [测试框架与 CommonJS/ESM 混用引发配置问题] → 先确认现有模块类型，必要时用 vitest 的 CJS 兼容配置。
- [全量格式化造成巨大 diff，掩盖真实改动] → 本变更不执行全量格式化；配置文件独立落地。
- [测试文件被打进生产部署] → 在 `sync-and-deploy.sh` 与 `.gitignore` 层面确认测试目录不参与推送/构建。

## Migration Plan

- 无运行时迁移。部署脚本与 systemd 配置不变。
- 回滚：移除 devDependencies 与新增配置文件即可，不影响生产运行时。
