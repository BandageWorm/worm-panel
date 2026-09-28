#!/bin/bash
#
# Worm Panel 一键自动部署
#
# 流程：配置装载 -> 增量同步（git 检测 + scp）-> 远端构建重启 -> 部署后自检
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
SERVICE_NAME="worm-panel"

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
log_info()  { echo "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo "${RED}[ERROR]${NC} $1"; }

usage() {
  cat <<'USAGE'
Worm Panel 一键自动部署

用法（在仓库根目录）:
  bash scripts/deploy-ssh.sh                        按 .env 配置部署
  bash scripts/deploy-ssh.sh --server root@IP --dir /root/worm-panel
  bash scripts/deploy-ssh.sh --dry-run              仅列出将同步的文件，不推送
  bash scripts/deploy-ssh.sh --verify-only          仅做部署后自检
  bash scripts/deploy-ssh.sh --skip-verify          跳过部署后自检
  bash scripts/deploy-ssh.sh --from <ref>           额外同步 <ref> 到 HEAD 之间已提交的变更
  bash scripts/deploy-ssh.sh --verify-heavy         自检时实际调用 pm2.reloadAll（会重启 PM2 进程）
  bash scripts/deploy-ssh.sh --install-dir /opt/worm-panel

说明:
  DEPLOY_DIR        同步暂存目录（scp 落点），默认 /root/worm-panel
  DEPLOY_INSTALL_DIR 远端运行目录（构建与 systemd 服务的实际路径），默认 /opt/worm-panel
  默认只同步工作区（未提交）改动；改动已提交时请加 --from <ref>

配置优先级: 命令行参数 > 环境变量 > 仓库根 .env
USAGE
  exit 0
}

ARG_SERVER=""
ARG_DIR=""
ARG_INSTALL_DIR=""
ARG_FROM=""
DRY_RUN=0
VERIFY_ONLY=0
SKIP_VERIFY=0
VERIFY_HEAVY=0
NO_SYNC=0

while [ $# -gt 0 ]; do
  case "$1" in
    --server)        ARG_SERVER="${2:-}"; shift 2 ;;
    --dir)           ARG_DIR="${2:-}"; shift 2 ;;
    --install-dir)   ARG_INSTALL_DIR="${2:-}"; shift 2 ;;
    --from)          ARG_FROM="${2:-}"; shift 2 ;;
    --from=*)        ARG_FROM="${1#*=}"; shift ;;
    --dry-run)       DRY_RUN=1; shift ;;
    --verify-only)   VERIFY_ONLY=1; shift ;;
    --skip-verify)   SKIP_VERIFY=1; shift ;;
    --verify-heavy)  VERIFY_HEAVY=1; shift ;;
    -h|--help)       usage ;;
    *) log_error "未知参数: $1"; usage ;;
  esac
done

# ── 1. 配置装载（参数 > 环境变量 > .env）──

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
# 远端运行目录：deploy-local.sh 会把暂存目录 rsync 到这里并在其中构建、跑 systemd 服务
INSTALL_DIR="${ARG_INSTALL_DIR:-${DEPLOY_INSTALL_DIR:-/opt/worm-panel}}"

if [ -z "$SERVER" ]; then
  log_error "未配置部署服务器。请指定 --server，或创建 $ENV_FILE"
  log_error "  bash scripts/deploy-ssh.sh --server root@<ip> --dir <远端目录>"
  exit 1
fi

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)

# ── 2. 变更检测与增量同步 ──

cd "$REPO_ROOT"

# 用 git status --porcelain 统一收集变更（已修改 + 新增 + 删除 + 重命名）。
# 输出格式：每行 "XY <path>"（重命名为 "R  orig -> new"），据此拆分状态与路径。
#
# 注意 core.autocrlf：Windows 侧通常为 true（检出为 CRLF），WSL 侧默认未设置，
# 会把所有 CRLF 文本文件误判为"已修改"，进而把整份工作区推上服务器。
# 这里用 -c 做一次性覆盖（不写入仓库或全局 git 配置），保证两端变更集一致。
STATUS=$(git -c core.autocrlf=true status --porcelain 2>/dev/null || true)

# 可选：把 --from <ref> 到 HEAD 之间「已提交」的变更也并入待同步集合，
# 统一归一化成与 `git status --porcelain` 相同的 "XY path" 形式（重命名拆为删旧+增新）。
if [ -n "$ARG_FROM" ]; then
  if ! git rev-parse --verify --quiet "$ARG_FROM^{commit}" >/dev/null; then
    log_error "--from 指定的 ref 无效: $ARG_FROM"
    exit 1
  fi
  COMMITTED=$(git diff --name-status "$ARG_FROM" HEAD 2>/dev/null | awk -F'\t' '
    NF < 2 { next }
    {
      s = $1
      if (s ~ /^[RC]/) { print "DD " $2; print "MM " $3 }
      else { c = substr(s, 1, 1); print c c " " $2 }
    }' || true)
  STATUS=$(printf '%s\n%s\n' "$STATUS" "$COMMITTED")
fi

# 排除的路径前缀（构建产物、依赖、运行时数据、规划文档、开发期工具链等）
# 注意：test/、CI 工作流与 lint/format 配置只在开发与 CI 使用，不推送到生产服务器
EXCLUDE='node_modules|\.git|public/|data/|^openspec/|^\.claude/|^test/|^\.github/|^vitest\.config\.js|^eslint\.config\.js|^\.prettierrc|^\.prettierignore'

# 需要同步（新增/修改/重命名）的文件：排除已删除项
CHANGED=$(echo "$STATUS" | awk '
  {
    st = substr($0, 1, 2)
    path = substr($0, 4)
    # 重命名/复制取箭头后的新路径
    if (path ~ / -> /) { sub(/^.* -> /, "", path) }
    # 去除可能的引号（含特殊字符文件名时 git 会加引号）
    gsub(/^"|"$/, "", path)
    # 跳过已删除的文件（在 DELETED 中单独处理）
    if (st ~ /D/) next
    print path
  }' | grep -v '^$' | grep -vE "$EXCLUDE" | sort -u || true)

# 已删除的文件：需要在远端一并删除
DELETED=$(echo "$STATUS" | awk '
  {
    st = substr($0, 1, 2)
    path = substr($0, 4)
    if (path ~ / -> /) { sub(/^.* -> /, "", path) }
    gsub(/^"|"$/, "", path)
    if (st ~ /D/) print path
  }' | grep -v '^$' | grep -vE "$EXCLUDE" | sort -u || true)

ALL_FILES="$CHANGED"
NO_SYNC=0

if [ "$VERIFY_ONLY" -eq 1 ]; then
  log_info "仅执行部署后自检（--verify-only）"
  NO_SYNC=1
elif [ "$DRY_RUN" -eq 1 ]; then
  if [ -z "$ALL_FILES" ]; then
    log_info "No files to sync（工作区无改动；若变更已提交，请加 --from <ref>）"
  else
    echo ""
    log_info "Files to sync ($(echo "$ALL_FILES" | wc -l) files):"
    echo "$ALL_FILES" | sed 's/^/  /'
  fi
  echo ""
  log_info "DRY RUN：仅列出变更文件，不推送"
  exit 0
elif [ -z "$ALL_FILES" ]; then
  log_info "No files to sync（工作区无改动；若变更已提交，请加 --from <ref>）"
  NO_SYNC=1
else
  echo ""
  log_info "Files to sync ($(echo "$ALL_FILES" | wc -l) files):"
  echo "$ALL_FILES" | sed 's/^/  /'

  log_info "部署目标: $SERVER  （暂存 $REMOTE_DIR / 运行 $INSTALL_DIR）"

  # 为新文件创建远端目录
  for d in $(dirname $ALL_FILES | sort -u); do
    ssh "${SSH_OPTS[@]}" "$SERVER" "mkdir -p '$REMOTE_DIR/$d'"
  done

  log_info "Syncing files..."
  SYNC_FAILED=""
  for f in $ALL_FILES; do
    if [ -f "$REPO_ROOT/$f" ]; then
      if scp "${SSH_OPTS[@]}" "$REPO_ROOT/$f" "$SERVER:$REMOTE_DIR/$f"; then
        echo "  ✓ $f"
      else
        echo "  ✗ $f"
        SYNC_FAILED="$SYNC_FAILED $f"
      fi
    fi
  done

  for f in $DELETED; do
    ssh "${SSH_OPTS[@]}" "$SERVER" "rm -f '$REMOTE_DIR/$f'" && echo "  - $f (deleted)" || true
  done

  if [ -n "$SYNC_FAILED" ]; then
    log_error "同步失败的文件:$SYNC_FAILED"
    exit 1
  fi

  log_ok "增量同步完成"

  # ── 远端构建与重启 ──

  echo ""
  log_info "在服务器上执行 scripts/deploy-local.sh ..."
  if ! ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$REMOTE_DIR' && bash scripts/deploy-local.sh"; then
    log_error "远端部署失败（scripts/deploy-local.sh 返回非零），请检查上方输出"
    exit 1
  fi
fi

# ── 3. 部署后自检 ──

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

echo ""
if [ "$SKIP_VERIFY" -eq 1 ]; then
  log_warn "已跳过部署后自检"
  exit 0
fi

if [ "$NO_SYNC" -eq 1 ]; then
  log_warn "本次没有文件同步到服务器，未触发远端构建/重启；以下自检针对服务器上「当前正在运行」的版本。"
fi

if verify_deployed; then
  echo ""
  if [ "$NO_SYNC" -eq 1 ]; then
    log_warn "自检通过，但本次并未部署任何变更（如需部署已提交的改动，请加 --from <ref>）"
  else
    log_ok "部署完成，自检全部通过"
  fi
else
  echo ""
  if [ "$NO_SYNC" -eq 1 ]; then
    log_error "自检未通过；且本次并未部署任何变更，失败项来自服务器当前运行的版本"
  else
    log_error "部署已执行，但自检未全部通过，请检查上方输出"
  fi
  exit 1
fi
