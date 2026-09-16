#!/bin/bash
#
# Sync changed files to server and deploy
# Usage: bash scripts/sync-and-deploy.sh
#
set -e

SERVER="${DEPLOY_SERVER:-}"
REMOTE_DIR="${DEPLOY_DIR:-/root/worm-panel}"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 支持从 .env 文件读取（不纳入版本控制）
ENV_FILE="$SOURCE_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  SERVER="${DEPLOY_SERVER:-$SERVER}"
  REMOTE_DIR="${DEPLOY_DIR:-$REMOTE_DIR}"
fi

if [ -z "$SERVER" ]; then
  log_error "DEPLOY_SERVER not set. Create .env file with: DEPLOY_SERVER=root@your-server-ip"
  exit 1
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$SOURCE_DIR"

# ── Collect changed files ──

# 用 git status --porcelain 统一收集变更（已修改 + 新增 + 删除 + 重命名）。
# 相比 `git diff HEAD --diff-filter`，porcelain 在跨挂载盘（WSL /mnt）场景下
# 对已跟踪文件的"已修改"判定更可靠，不会漏掉仅修改未新增的文件。
# 输出格式：每行 "XY <path>"（重命名为 "R  orig -> new"），据此拆分状态与路径。
STATUS=$(git status --porcelain 2>/dev/null || true)

# 排除的路径前缀（构建产物、依赖、运行时数据、规划文档等）
EXCLUDE='node_modules|\.git|public/|data/|^openspec/|^\.claude/'

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

if [ -z "$ALL_FILES" ]; then
  log_info "No files to sync"
  exit 0
fi

echo ""
log_info "Files to sync ($(echo "$ALL_FILES" | wc -l) files):"
echo "$ALL_FILES" | sed 's/^/  /'

# ── Create remote directories for new files ──

DIRS=$(dirname $ALL_FILES | sort -u)
for d in $DIRS; do
  ssh "$SERVER" "mkdir -p '$REMOTE_DIR/$d'" 2>/dev/null
done

# ── Sync files ──

log_info "Syncing files..."
FAILED=""
for f in $ALL_FILES; do
  if [ -f "$SOURCE_DIR/$f" ]; then
    if scp "$SOURCE_DIR/$f" "$SERVER:$REMOTE_DIR/$f" 2>/dev/null; then
      echo "  ✓ $f"
    else
      echo "  ✗ $f"
      FAILED="$FAILED $f"
    fi
  fi
done

# ── Handle deleted files ──

for f in $DELETED; do
  ssh "$SERVER" "rm -f '$REMOTE_DIR/$f'" 2>/dev/null && echo "  - $f (deleted)" || true
done

if [ -n "$FAILED" ]; then
  log_error "Failed to sync:$FAILED"
  exit 1
fi

log_ok "All files synced"

# ── Deploy ──

echo ""
log_info "Running deploy script on server..."
ssh "$SERVER" "cd '$REMOTE_DIR' && bash scripts/deploy.sh"
