#!/bin/bash
#
# Worm Panel - One-line Installation
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/BandageWorm/worm-panel/main/scripts/install-online.sh)
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

INSTALL_DIR="/opt/worm-panel"
REPO_URL="https://github.com/BandageWorm/worm-panel/archive/refs/heads/main.tar.gz"

if [ "$EUID" -ne 0 ]; then
  log_error "Please run as root (use sudo)"
  exit 1
fi

# ── Install curl if needed ──

if ! command -v curl &> /dev/null; then
  log_info "Installing curl..."
  apt-get update -qq && apt-get install -y -qq curl
fi

# ── Download and extract ──

log_info "Downloading worm-panel..."
TMP_FILE=$(mktemp /tmp/worm-panel-XXXXXX.tar.gz)
curl -fsSL "$REPO_URL" -o "$TMP_FILE"

if [ -d "$INSTALL_DIR" ]; then
  log_info "Removing existing installation..."
  rm -rf "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP_FILE" --strip-components=1 -C "$INSTALL_DIR"
rm -f "$TMP_FILE"

log_ok "Source extracted to $INSTALL_DIR"

# ── Run install script ──

log_info "Running install.sh..."
bash "$INSTALL_DIR/scripts/install.sh"
