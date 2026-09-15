#!/usr/bin/env bash
# =============================================================================
# VPS Panel - Update Script
# Pulls latest code, backs up database, updates dependencies, runs migrations.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()  { err "$@"; exit 1; }

INSTALL_DIR="/opt/vps-panel"
SERVICE_NAME="vps-panel"
BACKUP_DIR="${INSTALL_DIR}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ── Root Check ───────────────────────────────────────────────────────────────
if [[ "${EUID}" -ne 0 ]]; then
    die "This script must be run as root."
fi

# ── Backup Database ──────────────────────────────────────────────────────────
backup_database() {
    local DB_FILE="${INSTALL_DIR}/data/panel.db"
    if [[ -f "${DB_FILE}" ]]; then
        mkdir -p "${BACKUP_DIR}"
        cp "${DB_FILE}" "${BACKUP_DIR}/panel_${TIMESTAMP}.db"
        log "Database backed up to ${BACKUP_DIR}/panel_${TIMESTAMP}.db"

        # Keep only last 10 backups
        ls -1t "${BACKUP_DIR}"/panel_*.db 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
    fi
}

# ── Pull Latest Code ────────────────────────────────────────────────────────
pull_code() {
    log "Pulling latest code..."

    # Check if installed from git
    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        cd "${INSTALL_DIR}"
        git stash 2>/dev/null || true
        git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
        log "Git pull completed."
    else
        warn "Not a git repository. Skipping pull."
        warn "To update manually, replace files in ${INSTALL_DIR}/backend and ${INSTALL_DIR}/frontend"
    fi
}

# ── Update Python Dependencies ──────────────────────────────────────────────
update_dependencies() {
    log "Updating Python dependencies..."
    if [[ -f "${INSTALL_DIR}/venv/bin/pip" ]]; then
        "${INSTALL_DIR}/venv/bin/pip" install --upgrade pip 2>/dev/null || true
        if [[ -f "${INSTALL_DIR}/backend/requirements.txt" ]]; then
            "${INSTALL_DIR}/venv/bin/pip" install -r "${INSTALL_DIR}/backend/requirements.txt"
        fi
        log "Python dependencies updated."
    else
        warn "Virtual environment not found. Skipping dependency update."
    fi
}

# ── Run Database Migrations ────────────────────────────────────────────────
run_migrations() {
    log "Running database migrations..."
    if [[ -f "${INSTALL_DIR}/venv/bin/python" ]]; then
        cd "${INSTALL_DIR}/backend"
        "${INSTALL_DIR}/venv/bin/python" -c "
import asyncio, sys
sys.path.insert(0, '.')
from app.database import init_db
asyncio.run(init_db())
print('Database migrations completed.')
" 2>&1 || warn "Migration may have failed. Check logs."
    fi
}

# ── Restart Service ─────────────────────────────────────────────────────────
restart_service() {
    log "Restarting VPS Panel service..."

    if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
        systemctl restart "${SERVICE_NAME}"
        sleep 3
        if systemctl is-active --quiet "${SERVICE_NAME}"; then
            log "Service restarted successfully."
        else
            err "Service failed to start. Check: journalctl -u ${SERVICE_NAME} -n 50"
            exit 1
        fi
    else
        # Screen/tmux fallback
        if screen -list 2>/dev/null | grep -q "vps-panel"; then
            screen -S vps-panel -X quit 2>/dev/null || true
            sleep 2
        fi
        if command -v screen &>/dev/null; then
            screen -dmS vps-panel bash "${INSTALL_DIR}/run.sh"
            log "Service restarted in screen session."
        else
            warn "Neither systemd nor screen found. Please restart manually."
        fi
    fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${GREEN}VPS Panel - Update Script${NC}"
    echo "========================="
    echo ""

    backup_database
    pull_code
    update_dependencies
    run_migrations
    restart_service

    echo ""
    log "Update complete!"
    echo ""
}

main "$@"
