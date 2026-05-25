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

# ── Install backend dependencies ──

log_info "Installing backend dependencies..."
npm install --production
log_ok "Backend dependencies installed"

# ── Build frontend ──

log_info "Installing frontend dependencies..."
cd "$INSTALL_DIR/client"
npm install
log_ok "Frontend dependencies installed"

log_info "Building frontend (output to ../public)..."
npm run build
log_ok "Frontend built"

cd "$INSTALL_DIR"

# ── Update systemd service file ──

if [ -f worm-panel.service ]; then
  cp worm-panel.service /etc/systemd/system/worm-panel.service
  systemctl daemon-reload
  log_ok "systemd service file updated"
fi

# ── Ensure node path is available ──

if ! command -v /usr/bin/node &> /dev/null; then
  # Load nvm to locate node
  export NVM_DIR="$HOME/.nvm"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
  fi
  if command -v node &> /dev/null; then
    ln -sf "$(which node)" /usr/bin/node
    log_ok "/usr/bin/node linked to $(which node)"
  else
    log_warn "node not found, please install Node.js first"
  fi
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
