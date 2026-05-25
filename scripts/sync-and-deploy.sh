#!/bin/bash
#
# Sync changed files to server and deploy
# Usage: bash scripts/sync-and-deploy.sh
#
set -e

SERVER="root@38.47.114.109"
REMOTE_DIR="/root/worm-panel"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cd "$SOURCE_DIR"

# ── Collect changed files ──

MODIFIED=$(git diff HEAD --name-only --diff-filter=M 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null || true)
DELETED=$(git diff HEAD --name-only --diff-filter=D 2>/dev/null || true)

ALL_FILES=$(echo -e "$MODIFIED\n$UNTRACKED" | grep -v '^$' | grep -v 'node_modules' | grep -v '\.git' | grep -v 'public/' | grep -v 'data/' | sort -u || true)

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
