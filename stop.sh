#!/usr/bin/env bash
# =============================================================================
# NexPanel - Stop Script
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

INSTALL_DIR="/opt/nexpanel"
SERVICE_NAME="nexpanel"

# ── Root Check ───────────────────────────────────────────────────────────────
if [[ "${EUID}" -ne 0 ]]; then
    err "This script must be run as root."
    exit 1
fi

# ── Stop Systemd ────────────────────────────────────────────────────────────
stop_systemd() {
    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        systemctl stop "${SERVICE_NAME}"
        log "NexPanel stopped via systemd."
    else
        log "NexPanel is not running (systemd)."
    fi
}

# ── Stop Screen ─────────────────────────────────────────────────────────────
stop_screen() {
    if screen -list 2>/dev/null | grep -q "nexpanel"; then
        screen -S nexpanel -X quit 2>/dev/null
        log "NexPanel screen session terminated."
    else
        log "NexPanel is not running (screen)."
    fi
}

# ── Stop tmux ───────────────────────────────────────────────────────────────
stop_tmux() {
    if tmux has-session -t nexpanel 2>/dev/null; then
        tmux kill-session -t nexpanel 2>/dev/null
        log "NexPanel tmux session terminated."
    else
        log "NexPanel is not running (tmux)."
    fi
}

# ── Kill any remaining uvicorn processes ────────────────────────────────────
kill_remaining() {
    local PIDS
    PIDS=$(pgrep -f "uvicorn app.main:app" 2>/dev/null || true)
    if [[ -n "${PIDS}" ]]; then
        warn "Killing remaining uvicorn processes: ${PIDS}"
        echo "${PIDS}" | xargs kill -15 2>/dev/null || true
        sleep 2
        PIDS=$(pgrep -f "uvicorn app.main:app" 2>/dev/null || true)
        if [[ -n "${PIDS}" ]]; then
            echo "${PIDS}" | xargs kill -9 2>/dev/null || true
        fi
    fi
}

# ── Main ────────────────────────────────────────────────────────────────────
if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
    stop_systemd
fi

stop_screen
stop_tmux
kill_remaining

log "NexPanel stopped."
