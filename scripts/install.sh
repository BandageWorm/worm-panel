#!/bin/bash
#
# Worm Panel - Installation Script
# Supports: Ubuntu / Debian
#
# Usage: curl -fsSL https://get.wormpanel.io | bash
#        sudo bash install.sh
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

# ── Prerequisites ──

if [ "$EUID" -ne 0 ]; then
  log_error "Please run as root (use sudo)"
  exit 1
fi

if [ ! -f /etc/os-release ]; then
  log_error "Unsupported operating system"
  exit 1
fi
. /etc/os-release
log_info "Detected OS: $NAME $VERSION"

INSTALL_DIR="/opt/worm-panel"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Node.js ──

install_nodejs() {
  log_info "Installing nvm and Node.js 20.x..."

  # Install nvm
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

  # Load nvm
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  # Install and use Node.js 20
  nvm install 20
  nvm alias default 20

  # Create symlink for systemd service
  ln -sf "$(which node)" /usr/bin/node

  log_ok "Node.js $(node --version) installed via nvm"
}

if ! command -v node &> /dev/null; then
  install_nodejs
else
  NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 18 ]; then
    log_warn "Node.js $(node --version) is too old, upgrading to 20.x..."
    install_nodejs
  else
    log_ok "Node.js $(node --version) is already installed"
  fi
fi

# ── Nginx ──

if ! command -v nginx &> /dev/null; then
  log_info "Installing nginx..."
  apt-get install -y nginx
  systemctl enable nginx
  log_ok "Nginx installed and enabled"
else
  log_ok "Nginx $(nginx -v 2>&1 | grep -oP '[\d.]+' | head -1) is already installed"
fi

# ── Git ──

if ! command -v git &> /dev/null; then
  log_info "Installing git..."
  apt-get install -y git
fi

# ── Create Directories ──

log_info "Setting up directory structure at $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data/notes"
mkdir -p "$INSTALL_DIR/data/backups/nginx"
mkdir -p "$INSTALL_DIR/data/logs/workers"
mkdir -p "$INSTALL_DIR/data/workers"

# ── Copy Files ──

log_info "Copying project files..."
if [ "$SOURCE_DIR" != "$INSTALL_DIR" ]; then
  cp -r "$SOURCE_DIR"/. "$INSTALL_DIR/" 2>/dev/null || true
fi
cd "$INSTALL_DIR"

# ── Install Backend Dependencies ──

log_info "Installing backend dependencies..."
npm install --production
log_ok "Backend dependencies installed"

# ── Install Frontend Dependencies & Build ──

log_info "Installing frontend dependencies..."
cd "$INSTALL_DIR/client"
npm install
log_ok "Frontend dependencies installed"

log_info "Building frontend assets..."
npm run build
log_ok "Frontend built successfully"
cd "$INSTALL_DIR"

# ── Setup systemd Service ──

log_info "Configuring systemd service..."
cp worm-panel.service /etc/systemd/system/worm-panel.service
systemctl daemon-reload
systemctl enable worm-panel
log_ok "systemd service installed and enabled"

# ── Start Service ──

log_info "Starting Worm Panel..."
systemctl start worm-panel
sleep 2

# ── Get Setup Token ──

TOKEN=$(journalctl -u worm-panel -n 60 --no-pager 2>/dev/null \
  | grep -oP 'Setup token: \K[a-f0-9]+' | tail -1)

# ── Check Status ──

if systemctl is-active --quiet worm-panel; then
  log_ok "Worm Panel is running"
else
  log_warn "Worm Panel may not have started. Check: systemctl status worm-panel"
fi

# ── Done ──

IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || curl -s --max-time 3 icanhazip.com 2>/dev/null || echo "<SERVER_IP>")

echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  Worm Panel installation complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo ""
echo -e "  Panel URL:     ${GREEN}http://$IP:4567${NC}"
echo -e "  Setup URL:     ${GREEN}http://$IP:4567/#/setup${NC}"
echo -e "  Setup Token:   ${YELLOW}$TOKEN${NC}"
echo ""
echo -e "  ${CYAN}Manage:${NC}"
echo -e "    systemctl status worm-panel    # Check status"
echo -e "    systemctl restart worm-panel   # Restart"
echo -e "    journalctl -u worm-panel -f    # View logs"
echo ""
echo -e "  ${CYAN}Config:${NC}"
echo -e "    $INSTALL_DIR/data/config.json"
echo ""
