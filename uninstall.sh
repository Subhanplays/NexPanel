#!/usr/bin/env bash
# =============================================================================
# VPS Panel - Uninstall Script
# Removes the application, data, and service configuration.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

INSTALL_DIR="/opt/vps-panel"
SERVICE_NAME="vps-panel"
DATA_DIR="/var/lib/vps-panel"

# ── Root Check ───────────────────────────────────────────────────────────────
if [[ "${EUID}" -ne 0 ]]; then
    err "This script must be run as root."
    exit 1
fi

# ── Confirmation ────────────────────────────────────────────────────────────
echo -e "${RED}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║       VPS Panel - Uninstall                        ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║  This will permanently remove:                      ║"
echo "  ║    - Application files at ${INSTALL_DIR}             ║"
echo "  ║    - All data and database                          ║"
echo "  ║    - Systemd service configuration                  ║"
echo "  ║    - Docker network (vps-network)                   ║"
echo "  ║    - All VPS containers created by the panel        ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

read -rp "Are you sure you want to uninstall VPS Panel? (type 'yes' to confirm): " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo ""

# ── Stop Services ───────────────────────────────────────────────────────────
log "Stopping services..."

# Systemd
if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        systemctl stop "${SERVICE_NAME}"
    fi
    if systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null; then
        systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
    fi
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload 2>/dev/null || true
fi

# Screen/tmux
if screen -list 2>/dev/null | grep -q "vps-panel"; then
    screen -S vps-panel -X quit 2>/dev/null || true
fi
if tmux has-session -t vps-panel 2>/dev/null; then
    tmux kill-session -t vps-panel 2>/dev/null || true
fi

# Kill remaining processes
pkill -f "uvicorn app.main:app" 2>/dev/null || true

log "Services stopped."

# ── Remove VPS Containers ──────────────────────────────────────────────────
if command -v docker &>/dev/null; then
    log "Removing VPS containers created by the panel..."
    local CONTAINERS
    CONTAINERS=$(docker ps -a --filter "label=com.vps-panel.managed=true" -q 2>/dev/null || true)
    if [[ -n "${CONTAINERS}" ]]; then
        echo "${CONTAINERS}" | xargs docker rm -f 2>/dev/null || true
        log "VPS containers removed."
    else
        log "No panel-managed containers found."
    fi

    log "Removing Docker network..."
    docker network rm vps-network 2>/dev/null || true
fi

# ── Remove Application Files ────────────────────────────────────────────────
log "Removing application files..."
if [[ -d "${INSTALL_DIR}" ]]; then
    rm -rf "${INSTALL_DIR}"
    log "Application directory removed: ${INSTALL_DIR}"
fi

# ── Remove System Data ──────────────────────────────────────────────────────
log "Removing system data..."
if [[ -d "${DATA_DIR}" ]]; then
    rm -rf "${DATA_DIR}"
    log "Data directory removed: ${DATA_DIR}"
fi

# ── Remove Log Files ───────────────────────────────────────────────────────
log "Cleaning up log files..."
rm -f /var/log/vps-panel*.log 2>/dev/null || true

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}VPS Panel has been uninstalled successfully.${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
echo -e "  ${YELLOW}Note:${NC}"
echo -e "    - Docker is still installed on your system."
echo -e "    - Any VPS containers NOT created by the panel are untouched."
echo -e "    - Python and system packages remain installed."
echo ""
echo -e "  To completely remove Docker, run: sudo apt purge docker-ce"
echo ""
