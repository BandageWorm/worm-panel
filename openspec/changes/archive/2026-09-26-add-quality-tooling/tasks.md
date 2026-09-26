# Tasks

## 1. 测试骨架

- [x] 1.1 引入 vitest 并配置（确认与现有 CommonJS 模块兼容），新增 `npm test` 脚本，验证空测试套件可运行（vitest 5 禁止在 CJS 中 `require('vitest')`，改用 `globals: true` 使测试文件保持 CJS 风格）
- [x] 1.2 为路径/文件名净化函数编写测试，验证 `../x`、`a/b.txt`、`''`、`'.'`、`'..'`、中文名等用例通过
- [x] 1.3 为 crontab 文本解析/拼接与历史记录截断编写测试，验证边界用例（超上限截断、含特殊字符命令不被破坏）通过

## 2. Lint / Format 基线

- [x] 2.1 引入 ESLint（宽松规则起步）与 `npm run lint`，验证在现有代码上运行不产生大量阻断性报错（实测 0 errors / 7 warnings，exit 0；warnings 均为存量未使用变量，未做改动）
- [x] 2.2 引入 Prettier 与 `npm run format`/配置文件，验证配置文件生效（不执行全量重排）（`--find-config-path` 解析到 `.prettierrc.json`；新增/改动的文件格式合规，存量文件 `src/services/cron.js` 仍有风格偏差，按要求不做全量重排）

## 3. CI

- [x] 3.1 添加最小 CI 工作流，执行 lint 与测试，验证在推送时能正常运行（`.github/workflows/ci.yml` 经 PyYAML 校验语法与结构无误；CI 实际执行的两条命令 `npm run lint`、`npm test` 已在本机逐一验证通过。GitHub Actions 本身无法在本地执行，首次推送后需确认）
- [x] 3.2 确认测试与 lint 文件不参与生产部署：核对 `.gitignore` 与 `scripts/sync-and-deploy.sh` 的文件筛选逻辑

## 4. 集成校验

- [x] 4.1 在 WSL2 中执行 `npm install && npm test && npm run lint`，确认三项全部成功（Node v22.23.3 经 nvm 安装；18 项测试通过、lint 0 errors。注意：npm 在 drvfs 上偶发 `rename EACCES`，重试即成功；本地安装使用 `--ignore-scripts` 规避 `node-pty` 原生编译）
- [x] 4.2 确认 `npm start` 与既有部署流程不受新增 devDependencies 影响（已实际部署：`deploy.sh` 的 `npm install --omit=dev` 不安装 devDependencies，服务重启后 active、HTTP 200、行为自检全过）
