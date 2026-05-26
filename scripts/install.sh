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

# 更新 apt 缓存并安装基础工具（新系统可能没有 curl、build-essential）
log_info "Installing system prerequisites..."
apt-get update -qq
apt-get install -y -qq curl build-essential 2>/dev/null
log_ok "System prerequisites installed"

# ── Journald 日志限制（持久配置） ──
if ! grep -q "SystemMaxUse=20M" /etc/systemd/journald.conf 2>/dev/null; then
  echo "SystemMaxUse=20M" >> /etc/systemd/journald.conf
  systemctl restart systemd-journald
  log_ok "Journald log limit set to 20MB"
fi
journalctl --vacuum-size=20M 2>/dev/null || true

INSTALL_DIR="/opt/worm-panel"
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Node.js (always use nvm) ──

install_nodejs() {
  log_info "Installing nvm and Node.js 22.x..."

  # Install nvm (idempotent - safe to re-run)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

  # Load nvm
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  # Install and use Node.js 22
  nvm install 22
  nvm alias default 22

  # Symlink nvm's node to /usr/bin/node for systemd service
  ln -sf "$(which node)" /usr/bin/node

  log_ok "Node.js $(node --version) installed via nvm"
}

# 始终安装 nvm（无论系统是否有 node），避免系统自带 npm 损坏问题
install_nodejs

# 如果系统 apt 安装了 nodejs，卸载它以免干扰
if dpkg -l nodejs 2>/dev/null | grep -q '^ii'; then
  log_info "Removing system nodejs package (nvm will be used instead)..."
  apt-get remove -y nodejs 2>/dev/null && log_ok "System nodejs removed" || log_warn "Failed to remove system nodejs (ignored)"
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

# ── 全局 Node 依赖（pm2 进程管理、wrangler Workers 本地运行） ──

log_info "Installing global Node.js packages (pm2, wrangler)..."

# 确保使用 nvm 的 npm（系统 npm 可能损坏）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

npm install -g pm2 wrangler ws

log_ok "Global packages installed (pm2, wrangler)"

# ── rclone (云备份) ──

if ! command -v rclone &> /dev/null; then
  log_info "Installing rclone..."
  curl -fsSL https://rclone.org/install.sh | bash
  log_ok "rclone installed"
else
  log_ok "rclone $(rclone --version | head -1) is already installed"
fi

# ── aliyundrive-webdav (云备份代理) ──

if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
  log_info "Installing python3-pip..."
  apt-get install -y -qq python3-pip 2>/dev/null || log_warn "Failed to install pip, aliyundrive-webdav may not work"
fi

ALIYUNDRIVE_DAV_INSTALLED=false
if ! command -v aliyundrive-webdav &> /dev/null; then
  log_info "Installing aliyundrive-webdav..."
  PIP_CMD=$(command -v pip3 2>/dev/null || command -v pip 2>/dev/null || true)
  if [ -n "$PIP_CMD" ]; then
    $PIP_CMD install aliyundrive-webdav -q 2>/dev/null && { ALIYUNDRIVE_DAV_INSTALLED=true; log_ok "aliyundrive-webdav installed"; } || log_warn "aliyundrive-webdav 安装失败，可稍后手动安装: pip install aliyundrive-webdav"
  fi
else
  ALIYUNDRIVE_DAV_INSTALLED=true
  log_ok "aliyundrive-webdav is already installed"
fi

# ── Create systemd service for aliyundrive-webdav ──

if [ "$ALIYUNDRIVE_DAV_INSTALLED" = true ]; then
  log_info "Creating aliyundrive-webdav systemd service..."
  cat > /etc/systemd/system/aliyundrive-webdav.service << 'SERVICEEOF'
[Unit]
Description=aliyundrive-webdav
After=network.target

[Service]
Type=simple
EnvironmentFile=/etc/aliyundrive-webdav.conf
ExecStart=aliyundrive-webdav
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

  # 创建默认配置文件
  if [ ! -f /etc/aliyundrive-webdav.conf ]; then
    cat > /etc/aliyundrive-webdav.conf << 'CONFEOF'
# aliyundrive-webdav 配置
# 先运行 aliyundrive-webdav qr login 扫码登录后，
# 取消下面注释并修改密码，然后启动服务:
# systemctl start aliyundrive-webdav && systemctl enable aliyundrive-webdav
# PORT=8080
# WEBDAV_AUTH_USER=admin
# WEBDAV_AUTH_PASSWORD=你的密码
CONFEOF
    log_ok "aliyundrive-webdav config created at /etc/aliyundrive-webdav.conf"
  fi
  systemctl daemon-reload 2>/dev/null || true
fi

# ── Create Directories ──

log_info "Setting up directory structure at $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data/notes"
mkdir -p "$INSTALL_DIR/data/backups/nginx"

# ── Copy Files ──

log_info "Copying project files..."
if [ "$SOURCE_DIR" != "$INSTALL_DIR" ]; then
  cp -r "$SOURCE_DIR"/. "$INSTALL_DIR/" 2>/dev/null || true
fi
cd "$INSTALL_DIR"

# ── Install Backend Dependencies ──

log_info "Installing backend dependencies..."
npm install --omit=dev
log_ok "Backend dependencies installed"

# ── Install Frontend Dependencies & Build ──

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

log_info "Building frontend assets..."
npm run build
log_ok "Frontend built successfully"

# 清理临时 swap
if [ "$SWAP_ACTIVE" -eq 1 ]; then
  swapoff "$SWAP_FILE" 2>/dev/null
  rm -f "$SWAP_FILE"
  log_ok "Temporary swap removed"
fi

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

if command -v aliyundrive-webdav &> /dev/null; then
  echo -e "  ${CYAN}云备份 (aliyundrive-webdav):${NC}"
  echo -e "    aliyundrive-webdav qr login        # 扫码登录阿里云盘"
  echo -e "    systemctl start aliyundrive-webdav  # 启动 WebDAV 服务"
  echo -e "    # 先编辑: /etc/aliyundrive-webdav.conf 设置端口和密码"
  echo ""
fi

if command -v wrangler &> /dev/null; then
  echo -e "  ${CYAN}Wrangler (Cloudflare Workers 本地运行):${NC}"
  echo -e "    # 在 PM2 中运行 Worker 项目:"
  echo -e "    npx wrangler dev <entry> --port <port>"
  echo -e "    # 然后在面板 PM2 页面中管理进程"
  echo ""
fi
