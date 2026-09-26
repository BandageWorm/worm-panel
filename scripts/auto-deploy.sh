#!/bin/bash
#
# Worm Panel 一键自动部署
#
# 项目约定：脚本通过 WSL 运行，不使用 Git Bash。
#
# 流程：环境守卫 -> 配置装载 -> SSH 预检 -> 增量同步 -> 远端构建重启 -> 部署后自检
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
SYNC_SCRIPT="$SCRIPT_DIR/sync-and-deploy.sh"
SERVICE_NAME="worm-panel"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
log_info()  { echo "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo "${RED}[ERROR]${NC} $1"; }

usage() {
  cat <<'USAGE'
Worm Panel 一键自动部署（项目约定：通过 WSL 运行）

用法（在仓库根目录）:
  bash scripts/auto-deploy.sh                        按 .env 配置部署
  bash scripts/auto-deploy.sh --server root@IP --dir /root/worm-panel
  bash scripts/auto-deploy.sh --dry-run              仅列出将同步的文件，不推送
  bash scripts/auto-deploy.sh --verify-only          仅做部署后自检
  bash scripts/auto-deploy.sh --skip-verify          跳过部署后自检
  bash scripts/auto-deploy.sh --verify-heavy         自检时实际调用 pm2.reloadAll（会重启 PM2 进程）
  bash scripts/auto-deploy.sh --allow-non-wsl        允许非 WSL 环境运行（不推荐）
  bash scripts/auto-deploy.sh --install-dir /opt/worm-panel

说明:
  DEPLOY_DIR        同步暂存目录（scp 落点），默认 /root/worm-panel
  DEPLOY_INSTALL_DIR 远端运行目录（构建与 systemd 服务的实际路径），默认 /opt/worm-panel

配置优先级: 命令行参数 > 环境变量 > 仓库根 .env
USAGE
  exit 0
}

ARG_SERVER=""
ARG_DIR=""
ARG_INSTALL_DIR=""
DRY_RUN=0
VERIFY_ONLY=0
SKIP_VERIFY=0
VERIFY_HEAVY=0
ALLOW_NON_WSL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --server)        ARG_SERVER="${2:-}"; shift 2 ;;
    --dir)           ARG_DIR="${2:-}"; shift 2 ;;
    --install-dir)   ARG_INSTALL_DIR="${2:-}"; shift 2 ;;
    --dry-run)       DRY_RUN=1; shift ;;
    --verify-only)   VERIFY_ONLY=1; shift ;;
    --skip-verify)   SKIP_VERIFY=1; shift ;;
    --verify-heavy)  VERIFY_HEAVY=1; shift ;;
    --allow-non-wsl) ALLOW_NON_WSL=1; shift ;;
    -h|--help)       usage ;;
    *) log_error "未知参数: $1"; usage ;;
  esac
done

# ── 1. 环境守卫：本项目约定 shell 脚本走 WSL ──

case "$(uname -s)" in
  Linux*) ;;
  *)
    if [ "$ALLOW_NON_WSL" -eq 1 ]; then
      log_warn "当前不是 Linux/WSL 环境（$(uname -s)），已通过 --allow-non-wsl 继续"
    else
      log_error "检测到非 WSL/Linux 环境（$(uname -s)）。请改用 WSL 运行："
      log_error "  wsl -e bash -lc 'bash /mnt/d/Project/worm-panel/scripts/auto-deploy.sh'"
      log_error "如确需在当前环境运行，请追加 --allow-non-wsl"
      exit 1
    fi
    ;;
esac

# ── 2. 配置装载（参数 > 环境变量 > .env）──

ENV_SERVER=""
ENV_DIR=""
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
  ENV_SERVER="${DEPLOY_SERVER:-}"
  ENV_DIR="${DEPLOY_DIR:-}"
fi

SERVER="${ARG_SERVER:-${DEPLOY_SERVER:-$ENV_SERVER}}"
REMOTE_DIR="${ARG_DIR:-${DEPLOY_DIR:-$ENV_DIR}}"
REMOTE_DIR="${REMOTE_DIR:-/root/worm-panel}"
# 远端运行目录：deploy.sh 会把暂存目录 rsync 到这里并在其中构建、跑 systemd 服务
INSTALL_DIR="${ARG_INSTALL_DIR:-${DEPLOY_INSTALL_DIR:-/opt/worm-panel}}"

if [ -z "$SERVER" ]; then
  log_error "未配置部署服务器。请指定 --server，或创建 $ENV_FILE"
  log_error "  bash scripts/auto-deploy.sh --server root@<ip> --dir <远端目录>"
  exit 1
fi

# sync-and-deploy.sh 自行从 .env 读取配置，因此把生效值落盘，保证两处一致
if [ ! -f "$ENV_FILE" ] || [ "$SERVER" != "$ENV_SERVER" ] || [ "$REMOTE_DIR" != "$ENV_DIR" ]; then
  printf '# 部署配置（不纳入版本控制）\nDEPLOY_SERVER=%s\nDEPLOY_DIR=%s\n' "$SERVER" "$REMOTE_DIR" > "$ENV_FILE"
  log_ok "已写入 $ENV_FILE"
fi

log_info "部署目标: $SERVER  （暂存 $REMOTE_DIR / 运行 $INSTALL_DIR）"

# ── 3. 本地工具预检 ──

for tool in git ssh scp awk sed grep sort; do
  command -v "$tool" >/dev/null 2>&1 || { log_error "缺少本地工具: $tool"; exit 1; }
done
log_ok "本地工具齐全 (git/ssh/scp/awk/sed/grep/sort)"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)

# ── 4. 远端预检 ──

log_info "检查 SSH 连通性..."
if ! ssh "${SSH_OPTS[@]}" "$SERVER" "true" 2>/dev/null; then
  log_error "无法免密登录 $SERVER，请确认："
  log_error "  1) WSL 中存在可用私钥（~/.ssh/id_rsa，权限 0600）"
  log_error "  2) 服务器 22 端口可达"
  exit 1
fi
log_ok "SSH 免密登录正常"

REMOTE_CHECK=$(ssh "${SSH_OPTS[@]}" "$SERVER" "
  test -d '$REMOTE_DIR' && echo DIR_OK || echo DIR_MISSING
  test -d '$INSTALL_DIR' && echo INSTALL_OK || echo INSTALL_MISSING
  command -v node >/dev/null 2>&1 && echo NODE_OK || echo NODE_MISSING
  systemctl is-active $SERVICE_NAME 2>/dev/null || echo SERVICE_UNKNOWN
" 2>/dev/null || true)

echo "$REMOTE_CHECK" | grep -q DIR_OK     || { log_error "远端暂存目录不存在: $REMOTE_DIR"; exit 1; }
echo "$REMOTE_CHECK" | grep -q INSTALL_OK || { log_error "远端运行目录不存在: $INSTALL_DIR"; exit 1; }
echo "$REMOTE_CHECK" | grep -q NODE_OK    || { log_error "远端未找到 node，无法构建"; exit 1; }
log_ok "远端暂存目录 / 运行目录 / node 就绪"
log_info "部署前服务状态: $(echo "$REMOTE_CHECK" | tail -n 1)"

# ── 5. 部署后自检 ──

verify_deployed() {
  local failed=0

  log_info "自检 1/3: systemd 服务状态"
  local state
  state=$(ssh "${SSH_OPTS[@]}" "$SERVER" "systemctl is-active $SERVICE_NAME 2>/dev/null || echo unknown")
  if [ "$state" = "active" ]; then
    log_ok "服务状态: active"
  else
    log_error "服务状态: $state"
    failed=1
  fi

  log_info "自检 2/3: 面板 HTTP 可达性"
  local code
  code=$(ssh "${SSH_OPTS[@]}" "$SERVER" "curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:4567/ 2>/dev/null || echo 000")
  if [ "$code" = "200" ]; then
    log_ok "HTTP 自检: 200"
  else
    log_error "HTTP 自检: $code"
    failed=1
  fi

  if [ "$failed" -ne 0 ]; then
    log_warn "服务未通过基础自检，跳过行为自检"
    return "$failed"
  fi

  local heavy_env=""
  if [ "$VERIFY_HEAVY" -eq 1 ]; then
    heavy_env="WORM_VERIFY_HEAVY=1"
    log_warn "已启用 --verify-heavy：将实际调用 pm2.reloadAll()，会重启服务器上的 PM2 进程"
  fi

  log_info "自检 3/3: 核心行为（在运行目录 $INSTALL_DIR 用 node 直接校验模块）"
  if ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$INSTALL_DIR' && $heavy_env node" <<'REMOTE_NODE'
const fs = require('fs');
let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  [' + detail + ']' : ''));
}

(async () => {
  // 1) 文件读取：非 UTF-8 拒绝，UTF-8 正常
  try {
    const files = require('./src/services/files');
    const tmp = '/tmp/worm-verify-encoding.bin';
    fs.writeFileSync(tmp, Buffer.from([0xff, 0xfe, 0x41]));
    let msg = '';
    try { files.readFile(tmp); } catch (e) { msg = e.message; }
    check('files.readFile 拒绝非 UTF-8', msg === '不支持的文件编码', msg || '未抛错');
    fs.writeFileSync(tmp, 'hello 世界');
    let content = '';
    try { content = files.readFile(tmp).content; } catch (e) { content = 'ERR:' + e.message; }
    check('files.readFile 正常读取 UTF-8', content === 'hello 世界', JSON.stringify(content));
    fs.unlinkSync(tmp);
  } catch (e) {
    check('files 模块加载', false, e.message);
  }

  // 2) acme：安装状态与版本号；删除不存在证书返回 404
  try {
    const acme = require('./src/services/acme');
    const installed = acme.checkInstalled();
    check('acme.checkInstalled 为 true', installed === true, String(installed));
    const version = installed ? await acme.getVersion() : null;
    check('acme.getVersion 返回版本号', typeof version === 'string' && version.length > 0, String(version));
    let status = null;
    let emsg = '';
    try { await acme.deleteCert('worm-verify-nonexistent.example.com'); } catch (e) { status = e.status; emsg = e.message; }
    check('删除不存在证书返回 404', status === 404, 'status=' + status + ' msg=' + emsg);
  } catch (e) {
    check('acme 模块加载', false, e.message);
  }

  // 3) settings：切 proxy 但无域名 -> 400，且不写入 config
  try {
    const cfgPath = require.resolve('./src/services/config');
    let saveCalls = 0;
    require.cache[cfgPath] = {
      id: cfgPath,
      filename: cfgPath,
      loaded: true,
      exports: {
        load: () => ({ mode: 'standalone', port: 4567 }),
        save: () => { saveCalls++; }
      }
    };
    const express = require('express');
    const router = require('./src/routes/settings');
    const app = express();
    app.use(express.json());
    app.use('/api/settings', router);
    const server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const port = server.address().port;
    let code = 0;
    let body = '';
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'proxy' })
      });
      code = res.status;
      body = await res.text();
    } catch (e) {
      body = 'ERR:' + e.message;
    }
    check('settings 切 proxy 无域名返回 400', code === 400, 'status=' + code + ' body=' + body);
    check('settings 校验失败不写 config', saveCalls === 0, 'save 调用 ' + saveCalls + ' 次');
    server.close();
  } catch (e) {
    check('settings 路由加载', false, e.message);
  }

  // 4) pm2：reloadAll 已正确导出即可；实际执行会重启生产进程，仅 --verify-heavy 下进行
  try {
    const pm2 = require('./src/services/pm2');
    check('pm2.reloadAll 已导出', typeof pm2.reloadAll === 'function', typeof pm2.reloadAll);
    if (process.env.WORM_VERIFY_HEAVY === '1') {
      const reloaded = await pm2.reloadAll();
      check('pm2.reloadAll 实际执行（--verify-heavy）', Array.isArray(reloaded), JSON.stringify(reloaded));
    } else {
      console.log('SKIP  pm2.reloadAll 实际执行（会重启 PM2 进程，需 --verify-heavy）');
    }
  } catch (e) {
    check('pm2 模块加载', false, e.message);
  }

  console.log('---');
  console.log('行为自检: 失败 ' + failed + ' 项');
  process.exit(failed === 0 ? 0 : 1);
})();
REMOTE_NODE
  then
    log_ok "核心行为自检全部通过"
  else
    log_error "核心行为自检存在失败项（见上）"
    failed=1
  fi

  return "$failed"
}

# ── 6. 执行 ──

if [ "$VERIFY_ONLY" -eq 1 ]; then
  log_info "仅执行部署后自检（--verify-only）"
elif [ "$DRY_RUN" -eq 1 ]; then
  # 复用 sync-and-deploy.sh 的变更检测与排除规则，避免两处逻辑分叉
  log_info "DRY RUN：仅列出将同步的变更文件，不推送"
  echo ""
  DRY_RUN=1 bash "$SYNC_SCRIPT"
  exit 0
else
  log_info "开始增量同步并触发远端构建与重启..."
  echo ""
  bash "$SYNC_SCRIPT"
fi

# ── 7. 自检 ──

echo ""
if [ "$SKIP_VERIFY" -eq 1 ]; then
  log_warn "已跳过部署后自检"
  exit 0
fi

if verify_deployed; then
  echo ""
  log_ok "部署完成，自检全部通过"
else
  echo ""
  log_error "部署已执行，但自检未全部通过，请检查上方输出"
  exit 1
fi
