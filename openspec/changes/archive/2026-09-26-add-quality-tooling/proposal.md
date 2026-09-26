# Proposal

## Why

项目已有 17 个模块、18 个已归档变更，却没有任何测试、没有 ESLint/Prettier、没有 lint 脚本、没有 CI。随着模块增多，"改 A 坏 B" 的风险持续上升，尤其路径/命令净化类修复缺少回归保障，问题容易改完再犯。

## What Changes

- 引入后端测试框架（建议 vitest，可复用到前端），提供 `npm test` 脚本。
- 为不依赖服务器环境的关键逻辑补充回归测试：路径净化、文件名净化、crontab 解析/写入、配置读写等纯函数。
- 引入 ESLint + Prettier 与 `npm run lint` / `npm run format` 脚本，先以不引入大量改动的宽松规则起步。
- 提供最小 CI：至少执行 lint 与测试。
- 明确测试运行方式遵循项目既有约定，不在 Windows 原生环境运行（走 WSL2）。

**边界（不做什么）：**

- 不追求覆盖率指标，只建立骨架与关键回归。
- 不为依赖真实 nginx / PM2 / ufw / acme.sh 环境的路径编写集成测试。
- 不引入 TypeScript，不重构现有代码结构。
- 不改变任何产品行为（本变更 `skip_specs: true`）。

## Capabilities

### New Capabilities

<!-- 无 -->

### Modified Capabilities

<!-- 无：纯工程化改动，无 spec 级行为变化，变更在 .openspec.yaml 设置 skip_specs: true -->

## Impact

- `package.json`：新增 devDependencies（vitest、eslint、prettier 及相关插件）与 `test` / `lint` / `format` 脚本。
- 新增配置：测试配置、ESLint 配置、Prettier 配置、CI 工作流文件。
- 新增测试目录（如 `test/` 或与源文件同级的 `*.test.js`）。
- `scripts/sync-and-deploy.sh`：需确认测试文件/配置不参与生产部署推送。
- 若启用 Prettier 全量格式化，会产生大量纯格式 diff —— 需评估是并入本变更还是单列一步。
- 依赖：新增 devDependencies，不影响生产运行时依赖。
