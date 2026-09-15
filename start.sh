#!/usr/bin/env bash
# =============================================================================
# NexPanel - Start Script
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

# ── Start via Systemd ───────────────────────────────────────────────────────
start_systemd() {
    if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
        log "NexPanel is already running."
        return
    fi
    systemctl start "${SERVICE_NAME}"
    sleep 3
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        log "NexPanel started successfully."
    else
        err "Failed to start NexPanel. Check: journalctl -u ${SERVICE_NAME} -n 50"
        exit 1
    fi
}

# ── Start via Screen ────────────────────────────────────────────────────────
start_screen() {
    if screen -list 2>/dev/null | grep -q "nexpanel"; then
        log "NexPanel screen session already running."
        return
    fi
    if [[ -x "${INSTALL_DIR}/run.sh" ]]; then
        screen -dmS nexpanel bash "${INSTALL_DIR}/run.sh"
        sleep 2
        if screen -list 2>/dev/null | grep -q "nexpanel"; then
            log "NexPanel started in screen session."
        else
            err "Failed to start NexPanel in screen."
            exit 1
        fi
    else
        err "Startup script not found: ${INSTALL_DIR}/run.sh"
        exit 1
    fi
}

# ── Start via tmux ──────────────────────────────────────────────────────────
start_tmux() {
    if tmux has-session -t nexpanel 2>/dev/null; then
        log "NexPanel tmux session already running."
        return
    fi
    if [[ -x "${INSTALL_DIR}/run.sh" ]]; then
        tmux new-session -d -s nexpanel "bash ${INSTALL_DIR}/run.sh"
        sleep 2
        if tmux has-session -t nexpanel 2>/dev/null; then
            log "NexPanel started in tmux session."
        else
            err "Failed to start NexPanel in tmux."
            exit 1
        fi
    else
        err "Startup script not found: ${INSTALL_DIR}/run.sh"
        exit 1
    fi
}

# ── Main ────────────────────────────────────────────────────────────────────
if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
    start_systemd
elif command -v screen &>/dev/null; then
    start_screen
elif command -v tmux &>/dev/null; then
    start_tmux
else
    err "No process manager found (systemd, screen, or tmux)."
    exit 1
fi
