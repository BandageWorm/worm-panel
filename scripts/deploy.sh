#!/bin/bash
#
# Worm Panel - Redeploy Script
# 从当前源码目录重新构建并部署到 /opt/worm-panel
#
# Usage: bash scripts/redeploy.sh
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then
  log_error "Please run as root (sudo bash scripts/redeploy.sh)"
  exit 1
fi

INSTALL_DIR="/opt/worm-panel"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

log_info "Source directory: $SOURCE_DIR"
log_info "Target directory: $INSTALL_DIR"

# ── Copy files ──

log_info "Copying project files..."
rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='client/node_modules' \
  --exclude='client/dist' \
  --exclude='data' \
  --exclude='public' \
  "$SOURCE_DIR/" "$INSTALL_DIR/"

mkdir -p "$INSTALL_DIR/data/notes"
mkdir -p "$INSTALL_DIR/data/backups/nginx"
mkdir -p "$INSTALL_DIR/data/logs/workers"
mkdir -p "$INSTALL_DIR/data/workers"

log_ok "Files copied"

cd "$INSTALL_DIR"

# ── Load nvm (优先使用 nvm 管理 node/npm) ──

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  # 确保 systemd service 也能找到 nvm 的 node
  NODE_PATH="$(which node)"
  if [ -n "$NODE_PATH" ] && [ "$NODE_PATH" != "/usr/bin/node" ]; then
    ln -sf "$NODE_PATH" /usr/bin/node
    log_ok "Using nvm node: $NODE_PATH"
  fi
elif command -v node &> /dev/null; then
  log_warn "nvm not found, using system node: $(which node)"
else
  log_error "node not found, please install Node.js first"
  exit 1
fi

# ── Install backend dependencies ──

log_info "Installing backend dependencies..."
npm install --omit=dev
log_ok "Backend dependencies installed"

# ── Build frontend ──

log_info "Installing frontend dependencies..."
cd "$INSTALL_DIR/client"
npm install
log_ok "Frontend dependencies installed"

# 低内存服务器构建前端时临时启用 swap（Vite 打包大文件时可能 OOM）
SWAP_FILE="/swap.build"
SWAP_ACTIVE=0
if [ "$(free -m | awk '/^Mem:/{print $7}')" -lt 512 ]; then
  if ! swapon --show 2>/dev/null | grep -q .; then
    log_info "Available memory <512MB, creating temporary swap for build..."
    dd if=/dev/zero of="$SWAP_FILE" bs=1M count=1024 2>/dev/null
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE" 2>/dev/null
    swapon "$SWAP_FILE" 2>/dev/null && SWAP_ACTIVE=1
    log_ok "Temporary swap activated (1024MB)"
  fi
fi

log_info "Building frontend (output to ../public)..."
npm run build
log_ok "Frontend built"

# 清理临时 swap
if [ "$SWAP_ACTIVE" -eq 1 ]; then
  swapoff "$SWAP_FILE" 2>/dev/null
  rm -f "$SWAP_FILE"
  log_ok "Temporary swap removed"
fi

cd "$INSTALL_DIR"

# ── Update systemd service file ──

if [ -f worm-panel.service ]; then
  cp worm-panel.service /etc/systemd/system/worm-panel.service
  systemctl daemon-reload
  log_ok "systemd service file updated"
fi

# ── Restart service ──

log_info "Restarting Worm Panel..."
systemctl restart worm-panel
sleep 2

# ── Check status ──

if systemctl is-active --quiet worm-panel; then
  log_ok "Worm Panel is running"
else
  log_error "Worm Panel failed to start, check logs: journalctl -u worm-panel -n 50 --no-pager"
fi

# ── Vacuum journal logs to 20MB ──
journalctl --vacuum-size=20M 2>/dev/null && log_info "Journal logs vacuumed to 20MB" || true

# ── Show startup logs ──

echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Recent logs:${NC}"
journalctl -u worm-panel -n 10 --no-pager
echo ""
echo -e "  ${CYAN}Tail logs:${NC}     journalctl -u worm-panel -f"
echo -e "  ${CYAN}Restart:${NC}       systemctl restart worm-panel"
echo ""
