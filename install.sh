#!/usr/bin/env bash
# =============================================================================
# NexPanel - One-Command Installer
# Supports: Ubuntu 20.04+, Debian 11+, CentOS 8+, Rocky 8+, AlmaLinux 8+
# Usage:    curl -sL https://raw.githubusercontent.com/.../install.sh | bash
#           or: sudo bash install.sh
# =============================================================================
set -euo pipefail

# ── Colors & Logging ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()  { err "$@"; exit 1; }

# ── Variables ────────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/nexpanel"
SERVICE_NAME="nexpanel"
PYTHON_MIN_VERSION="3.11"
DATA_DIR="${INSTALL_DIR}/data"
BACKEND_DIR="${INSTALL_DIR}/backend"
FRONTEND_DIR="${INSTALL_DIR}/frontend-new"
ENV_FILE="${INSTALL_DIR}/.env"

# ── Root Check ───────────────────────────────────────────────────────────────
check_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        die "This installer must be run as root. Use: sudo bash install.sh"
    fi
}

# ── Detect Distro ────────────────────────────────────────────────────────────
detect_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        DISTRO_ID="${ID}"
        DISTRO_VERSION="${VERSION_ID}"
    elif [[ -f /etc/centos-release ]]; then
        DISTRO_ID="centos"
        DISTRO_VERSION=$(grep -oE '[0-9]+' /etc/centos-release | head -1)
    else
        die "Cannot detect Linux distribution. Only Ubuntu, Debian, CentOS, Rocky, and AlmaLinux are supported."
    fi

    case "${DISTRO_ID}" in
        ubuntu|debian|centos|rocky|almalinux)
            log "Detected: ${PRETTY_NAME:-$DISTRO_ID $DISTRO_VERSION}"
            ;;
        *)
            die "Unsupported distribution: ${DISTRO_ID}. Supported: ubuntu, debian, centos, rocky, almalinux"
            ;;
    esac
}

# ── Detect Package Manager ───────────────────────────────────────────────────
detect_pkg_manager() {
    if command -v apt-get &>/dev/null; then
        PKG_MANAGER="apt"
        PKG_INSTALL="apt-get install -y"
        PKG_UPDATE="apt-get update -y"
    elif command -v dnf &>/dev/null; then
        PKG_MANAGER="dnf"
        PKG_INSTALL="dnf install -y"
        PKG_UPDATE="dnf check-update || true"
    elif command -v yum &>/dev/null; then
        PKG_MANAGER="yum"
        PKG_INSTALL="yum install -y"
        PKG_UPDATE="yum check-update || true"
    else
        die "No supported package manager found (apt, dnf, yum)"
    fi
    log "Package manager: ${PKG_MANAGER}"
}

# ── Install System Dependencies ──────────────────────────────────────────────
install_dependencies() {
    log "Updating package lists..."
    ${PKG_UPDATE} || true

    local BASE_DEPS="curl wget git sudo unzip tar"
    local BUILD_DEPS="gcc g++ make"
    local PYTHON_DEPS=""

    case "${PKG_MANAGER}" in
        apt)
            PYTHON_DEPS="python3 python3-pip python3-venv python3-dev"
            ${PKG_INSTALL} ${BASE_DEPS} ${BUILD_DEPS} ${PYTHON_DEPS} \
                ca-certificates gnupg lsb-release || true
            ;;
        dnf|yum)
            PYTHON_DEPS="python3 python3-pip python3-devel"
            ${PKG_INSTALL} ${BASE_DEPS} ${BUILD_DEPS} ${PYTHON_DEPS} \
                ca-certificates gnupg2 || true
            ;;
    esac

    log "System dependencies installed."
}

# ── Check Python Version ────────────────────────────────────────────────────
check_python() {
    log "Checking Python version (>= ${PYTHON_MIN_VERSION})..."

    local PYTHON_CMD=""
    for cmd in python3.12 python3.11 python3; do
        if command -v "${cmd}" &>/dev/null; then
            local ver
            ver=$("${cmd}" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
            local major minor
            major=$(echo "${ver}" | cut -d. -f1)
            minor=$(echo "${ver}" | cut -d. -f2)
            if [[ "${major}" -ge 3 && "${minor}" -ge 11 ]]; then
                PYTHON_CMD="${cmd}"
                log "Found Python ${ver} at $(command -v "${cmd}")"
                break
            fi
        fi
    done

    if [[ -z "${PYTHON_CMD}" ]]; then
        warn "Python >= 3.11 not found. Installing Python 3.11..."
        install_python311
        PYTHON_CMD="python3.11"
    fi

    # Ensure pip is available
    if ! "${PYTHON_CMD}" -m pip --version &>/dev/null; then
        warn "pip not found for ${PYTHON_CMD}. Installing..."
        case "${PKG_MANAGER}" in
            apt)
                ${PKG_INSTALL} python3-pip python3.11-venv 2>/dev/null || \
                    "${PYTHON_CMD}" -m ensurepip --upgrade 2>/dev/null || true
                ;;
            dnf|yum)
                ${PKG_INSTALL} python3-pip 2>/dev/null || \
                    "${PYTHON_CMD}" -m ensurepip --upgrade 2>/dev/null || true
                ;;
        esac
    fi

    # Ensure venv module
    if ! "${PYTHON_CMD}" -m venv --help &>/dev/null 2>&1; then
        warn "python3-venv not found. Installing..."
        case "${PKG_MANAGER}" in
            apt)
                ${PKG_INSTALL} python3.11-venv python3-venv 2>/dev/null || true
                ;;
            dnf|yum)
                ${PKG_INSTALL} python3-virtualenv 2>/dev/null || true
                ;;
        esac
    fi

    PYTHON="${PYTHON_CMD}"
    log "Using: ${PYTHON} ($(${PYTHON} --version 2>&1))"
}

# ── Install Python 3.11 if missing ──────────────────────────────────────────
install_python311() {
    case "${PKG_MANAGER}" in
        apt)
            if ! grep -q "deadsnakes" /etc/apt/sources.list.d/*.list 2>/dev/null; then
                ${PKG_INSTALL} software-properties-common || true
                add-apt-repository -y ppa:deadsnakes/ppa 2>/dev/null || true
                apt-get update -y 2>/dev/null || true
            fi
            ${PKG_INSTALL} python3.11 python3.11-venv python3.11-dev python3-pip 2>/dev/null || true
            ;;
        dnf|yum)
            ${PKG_INSTALL} python3.11 python3.11-pip python3.11-devel 2>/dev/null || \
                ${PKG_INSTALL} python311 python311-pip python311-devel 2>/dev/null || true
            ;;
    esac
}

# ── Install Docker ──────────────────────────────────────────────────────────
install_docker() {
    if command -v docker &>/dev/null; then
        log "Docker already installed: $(docker --version)"
    else
        log "Installing Docker..."
        curl -fsSL https://get.docker.com | bash
        systemctl enable docker 2>/dev/null || true
        systemctl start docker 2>/dev/null || true
        log "Docker installed: $(docker --version)"
    fi

    # Ensure Docker socket is accessible
    if [[ ! -S /var/run/docker.sock ]]; then
        die "Docker socket not found at /var/run/docker.sock"
    fi

    # Add current user to docker group (for non-root convenience)
    local SUDO_USER="${SUDO_USER:-}"
    if [[ -n "${SUDO_USER}" ]]; then
        usermod -aG docker "${SUDO_USER}" 2>/dev/null || true
        log "Added ${SUDO_USER} to docker group"
    fi
}

# ── Install Node.js (optional, for frontend build) ─────────────────────────
install_nodejs() {
    if command -v node &>/dev/null; then
        log "Node.js already installed: $(node --version)"
        return
    fi

    log "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null || \
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>/dev/null || true
    ${PKG_INSTALL} nodejs 2>/dev/null || true

    if command -v node &>/dev/null; then
        log "Node.js installed: $(node --version)"
    else
        warn "Node.js installation failed. Frontend build may not work."
    fi
}

# ── Create Project Directories ──────────────────────────────────────────────
create_directories() {
    log "Creating project directories..."
    mkdir -p "${INSTALL_DIR}"
    mkdir -p "${DATA_DIR}"
    mkdir -p "${BACKEND_DIR}"
    mkdir -p "${FRONTEND_DIR}"
    mkdir -p "${INSTALL_DIR}/logs"
    mkdir -p "${INSTALL_DIR}/backups"
    mkdir -p /var/lib/nexpanel/data
    log "Directories created."
}

# ── Copy Project Files ──────────────────────────────────────────────────────
copy_files() {
    local SCRIPT_DIR
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    log "Copying project files to ${INSTALL_DIR}..."

    # Copy backend
    if [[ -d "${SCRIPT_DIR}/backend" ]]; then
        cp -r "${SCRIPT_DIR}/backend/"* "${BACKEND_DIR}/"
    fi

    # Copy frontend
    if [[ -d "${SCRIPT_DIR}/frontend-new" ]]; then
        cp -r "${SCRIPT_DIR}/frontend-new/"* "${FRONTEND_DIR}/"
    fi

    # Copy management scripts
    for script in start.sh stop.sh restart.sh update.sh uninstall.sh; do
        if [[ -f "${SCRIPT_DIR}/${script}" ]]; then
            cp "${SCRIPT_DIR}/${script}" "${INSTALL_DIR}/${script}"
            chmod +x "${INSTALL_DIR}/${script}"
        fi
    done

    # Copy .env.example as template
    if [[ -f "${SCRIPT_DIR}/.env.example" ]]; then
        cp "${SCRIPT_DIR}/.env.example" "${ENV_FILE}.example"
    fi

    log "Project files copied."
}

# ── Set Up Python Virtual Environment ───────────────────────────────────────
setup_venv() {
    log "Setting up Python virtual environment..."
    "${PYTHON}" -m venv "${INSTALL_DIR}/venv"
    source "${INSTALL_DIR}/venv/bin/activate"

    pip install --upgrade pip setuptools wheel 2>/dev/null || true

    if [[ -f "${BACKEND_DIR}/requirements.txt" ]]; then
        log "Installing Python dependencies..."
        pip install -r "${BACKEND_DIR}/requirements.txt"
    fi

    log "Virtual environment ready."
}

# ── Generate .env File ─────────────────────────────────────────────────────
generate_env() {
    if [[ -f "${ENV_FILE}" ]]; then
        warn ".env file already exists. Skipping generation."
        warn "To regenerate, delete ${ENV_FILE} and re-run this installer."
        return
    fi

    log "Generating .env configuration..."

    local SECRET_KEY
    SECRET_KEY=$("${PYTHON}" -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || \
                 openssl rand -hex 32 2>/dev/null || \
                 head -c 64 /dev/urandom | sha256sum | cut -d' ' -f1)

    local JWT_SECRET
    JWT_SECRET=$("${PYTHON}" -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || \
                 openssl rand -hex 32 2>/dev/null || \
                 head -c 64 /dev/urandom | sha256sum | cut -d' ' -f1)

    local BOT_API_KEY
    BOT_API_KEY=$("${PYTHON}" -c "import secrets; print(secrets.token_hex(16))" 2>/dev/null || \
                  openssl rand -hex 16 2>/dev/null || \
                  head -c 32 /dev/urandom | sha256sum | cut -d' ' -f1)

    cat > "${ENV_FILE}" <<EOF
# NexPanel Configuration - Generated by installer on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Application
APP_NAME=NexPanel
APP_URL=http://localhost:8000
SECRET_KEY=${SECRET_KEY}
DEBUG=false

# Database
DATABASE_URL=sqlite+aiosqlite:///./data/panel.db
DB_ECHO=false

# JWT
JWT_SECRET_KEY=${JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
DOCKER_TLS_VERIFY=false
DOCKER_API_VERSION=auto
DOCKER_NETWORK=vps-network
DOCKER_SUBNET=172.20.0.0/16
DOCKER_DATA_DIR=/var/lib/nexpanel/data
DOCKER_IMAGE_BUILD_TIMEOUT=600
DOCKER_CONTAINER_START_TIMEOUT=120
MAX_CONTAINERS=100

# VPS Defaults
DEFAULT_CPU_CORES=1
DEFAULT_RAM_GB=1
DEFAULT_DISK_GB=20
MAX_CPU_CORES=8
MAX_RAM_GB=32
MAX_DISK_GB=500
MAX_VPS_PER_USER=3
DEFAULT_OS_IMAGE=ubuntu:22.04

# IP Pool
IP_POOL_SUBNET=10.0.0.0/24
IP_POOL_GATEWAY=10.0.0.1
IP_POOL_DNS=8.8.8.8,8.8.4.4
IP_POOL_INTERFACE=eth0

# Tailscale
TAILSCALE_AUTH_KEY=
TAILSCALE_API_KEY=
TAILSCALE_NETWORK=100.64.0.0/10
TAILSCALE_TIMEOUT=30
TAILSCALE_INSTALL=true

# tmate
TMATE_ENABLED=true
TMATE_SERVER=tmate.io
TMATE_TIMEOUT=30

# SSHX
SSHX_ENABLED=true
SSHX_SERVER=
SSHX_TIMEOUT=30

# Discord Bot
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_WEBHOOK_URL=
BOT_API_KEY=${BOT_API_KEY}

# API Security
ADMIN_API_KEY=
RATE_LIMIT_PER_MINUTE=60

# CORS
ALLOWED_HOSTS=["*"]
CORS_ORIGINS=http://localhost:8000,http://localhost:3000

# Audit
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90

# Monitoring
MONITORING_INTERVAL=60
ANTI_MINER_ENABLED=true
ANTI_MINER_CHECK_INTERVAL=300

# Branding
BRAND_NAME=NexPanel
BRAND_COLOR=#6366f1
BRAND_FOOTER=Powered by NexPanel
EOF

    log ".env file generated at ${ENV_FILE}"
}

# ── Prompt for Admin Credentials ────────────────────────────────────────────
prompt_admin() {
    log "Setting up admin account..."

    local ADMIN_EMAIL ADMIN_USERNAME ADMIN_PASSWORD

    # Check if non-interactive
    if [[ ! -t 0 ]]; then
        warn "Non-interactive mode. Using default admin credentials."
        ADMIN_EMAIL="admin@nexpanel.local"
        ADMIN_USERNAME="admin"
        ADMIN_PASSWORD=$(openssl rand -base64 16 2>/dev/null || "${PYTHON}" -c "import secrets; print(secrets.token_urlsafe(16))")
        warn "Generated admin password: ${ADMIN_PASSWORD}"
    else
        read -rp "Admin email [admin@nexpanel.local]: " ADMIN_EMAIL
        ADMIN_EMAIL="${ADMIN_EMAIL:-admin@nexpanel.local}"

        read -rp "Admin username [admin]: " ADMIN_USERNAME
        ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"

        read -srp "Admin password [changeme]: " ADMIN_PASSWORD
        ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
        echo

        if [[ "${ADMIN_PASSWORD}" == "changeme" ]]; then
            warn "Using default password. Change it after first login!"
        fi
    fi

    # Update .env with admin credentials
    if [[ -f "${ENV_FILE}" ]]; then
        sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL}|" "${ENV_FILE}"
        sed -i "s|^ADMIN_USERNAME=.*|ADMIN_USERNAME=${ADMIN_USERNAME}|" "${ENV_FILE}"
        sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" "${ENV_FILE}"
    fi

    log "Admin account configured: ${ADMIN_EMAIL} / ${ADMIN_USERNAME}"
}

# ── Create Docker Network ──────────────────────────────────────────────────
setup_docker_network() {
    local NETWORK_NAME="vps-network"
    if ! docker network inspect "${NETWORK_NAME}" &>/dev/null; then
        log "Creating Docker network: ${NETWORK_NAME}"
        docker network create \
            --driver bridge \
            --subnet 172.20.0.0/16 \
            --ip-range 172.20.0.0/24 \
            "${NETWORK_NAME}" 2>/dev/null || warn "Docker network creation failed (may already exist)"
    else
        log "Docker network '${NETWORK_NAME}' already exists."
    fi
}

# ── Create Systemd Service ──────────────────────────────────────────────────
setup_systemd() {
    log "Setting up systemd service..."

    cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=NexPanel - VPS Management Service
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${INSTALL_DIR}/backend
Environment=PATH=${INSTALL_DIR}/venv/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=${ENV_FILE}
ExecStart=${INSTALL_DIR}/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=10
StandardOutput=append:${INSTALL_DIR}/logs/panel.log
StandardError=append:${INSTALL_DIR}/logs/panel.log
TimeoutStartSec=60
TimeoutStopSec=30

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${INSTALL_DIR} /var/lib/nexpanel /tmp
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}
    log "Systemd service installed and enabled."
}

# ── Fallback: Screen/Tmux Supervisor ────────────────────────────────────────
setup_screen_supervisor() {
    if ! command -v screen &>/dev/null && ! command -v tmux &>/dev/null; then
        log "Installing screen for process supervision..."
        ${PKG_INSTALL} screen 2>/dev/null || ${PKG_INSTALL} tmux 2>/dev/null || true
    fi

    # Create startup script for screen/tmux
    cat > "${INSTALL_DIR}/run.sh" <<'RUNEOF'
#!/usr/bin/env bash
cd "$(dirname "$0")/backend"
source "../venv/bin/activate"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
RUNEOF
    chmod +x "${INSTALL_DIR}/run.sh"

    # Create screen-based start/stop
    if command -v screen &>/dev/null; then
        cat > "${INSTALL_DIR}/screen-rc" <<SCREENEOF
sessionname nexpanel
chdir ${INSTALL_DIR}/backend
command ${INSTALL_DIR}/run.sh
logfile ${INSTALL_DIR}/logs/panel.log
logfile flush 1
SCREENEOF
        log "Screen supervisor configured."
    fi
}

# ── Create Management Scripts (installed copies) ─────────────────────────────
create_management_scripts() {
    local SCRIPT_DIR
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # start.sh (installed version with absolute paths)
    cat > "${INSTALL_DIR}/start.sh" <<STARTEOF
#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${INSTALL_DIR}"

start_systemd() {
    if systemctl is-active --quiet ${SERVICE_NAME} 2>/dev/null; then
        echo "[INFO] Service already running."
        return
    fi
    systemctl start ${SERVICE_NAME}
    echo "[INFO] NexPanel started via systemd."
}

start_screen() {
    if screen -list 2>/dev/null | grep -q "nexpanel"; then
        echo "[INFO] Screen session 'nexpanel' already running."
        return
    fi
    screen -dmS nexpanel bash "\${INSTALL_DIR}/run.sh"
    echo "[INFO] NexPanel started in screen session."
}

if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
    start_systemd
else
    start_screen
fi
STARTEOF
    chmod +x "${INSTALL_DIR}/start.sh"

    # stop.sh
    cat > "${INSTALL_DIR}/stop.sh" <<STOPEOF
#!/usr/bin/env bash
set -euo pipefail

stop_systemd() {
    if systemctl is-active --quiet ${SERVICE_NAME} 2>/dev/null; then
        systemctl stop ${SERVICE_NAME}
        echo "[INFO] NexPanel stopped via systemd."
    fi
}

stop_screen() {
    if screen -list 2>/dev/null | grep -q "nexpanel"; then
        screen -S nexpanel -X quit 2>/dev/null
        echo "[INFO] NexPanel screen session terminated."
    fi
}

if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
    stop_systemd
else
    stop_screen
fi
STOPEOF
    chmod +x "${INSTALL_DIR}/stop.sh"

    # restart.sh
    cat > "${INSTALL_DIR}/restart.sh" <<RESTARTEOF
#!/usr/bin/env bash
set -euo pipefail
"\${0%/restart.sh}/stop.sh"
sleep 2
"\${0%/restart.sh}/start.sh"
RESTARTEOF
    chmod +x "${INSTALL_DIR}/restart.sh"
}

# ── Create Admin User ──────────────────────────────────────────────────────
create_admin_user() {
    log "Creating admin user..."

    local ADMIN_EMAIL ADMIN_USERNAME ADMIN_PASSWORD
    ADMIN_EMAIL=$(grep -E "^ADMIN_EMAIL=" "${ENV_FILE}" | cut -d= -f2- || echo "admin@nexpanel.local")
    ADMIN_USERNAME=$(grep -E "^ADMIN_USERNAME=" "${ENV_FILE}" | cut -d= -f2- || echo "admin")
    ADMIN_PASSWORD=$(grep -E "^ADMIN_PASSWORD=" "${ENV_FILE}" | cut -d= -f2- || echo "changeme")

    if [[ -f "${INSTALL_DIR}/venv/bin/python" ]]; then
        cd "${BACKEND_DIR}"
        "${INSTALL_DIR}/venv/bin/python" -c "
import asyncio, sys
sys.path.insert(0, '${BACKEND_DIR}')

async def create():
    from app.database import init_db, async_session_maker
    from app.middleware.auth import hash_password
    from app.models.models import User
    from sqlalchemy import select

    await init_db()

    async with async_session_maker() as session:
        result = await session.execute(
            select(User).where((User.email == '${ADMIN_EMAIL}') | (User.username == '${ADMIN_USERNAME}'))
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f'Admin user already exists: {existing.username}')
            return

        user = User(
            email='${ADMIN_EMAIL}',
            username='${ADMIN_USERNAME}',
            hashed_password=hash_password('${ADMIN_PASSWORD}'),
            is_admin=True,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        print('Admin user created successfully.')

asyncio.run(create())
" 2>&1 || warn "Admin user creation failed. You may need to create it manually."
    fi
}

# ── Print Summary ──────────────────────────────────────────────────────────
print_summary() {
    local ADMIN_EMAIL ADMIN_USERNAME ADMIN_PASSWORD
    ADMIN_EMAIL=$(grep -E "^ADMIN_EMAIL=" "${ENV_FILE}" | cut -d= -f2-)
    ADMIN_USERNAME=$(grep -E "^ADMIN_USERNAME=" "${ENV_FILE}" | cut -d= -f2-)
    ADMIN_PASSWORD=$(grep -E "^ADMIN_PASSWORD=" "${ENV_FILE}" | cut -d= -f2-)

    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}   NexPanel - Installation Complete!${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
    echo -e "  ${GREEN}Dashboard URL:${NC}  http://$(hostname -I | awk '{print $1}'):8000"
    echo -e "  ${GREEN}Local URL:${NC}      http://localhost:8000"
    echo ""
    echo -e "  ${GREEN}Admin Email:${NC}     ${ADMIN_EMAIL}"
    echo -e "  ${GREEN}Admin Username:${NC}  ${ADMIN_USERNAME}"
    echo -e "  ${GREEN}Admin Password:${NC}  ${ADMIN_PASSWORD}"
    echo ""
    echo -e "  ${GREEN}Install Dir:${NC}    ${INSTALL_DIR}"
    echo -e "  ${GREEN}Config File:${NC}    ${ENV_FILE}"
    echo -e "  ${GREEN}Log File:${NC}       ${INSTALL_DIR}/logs/panel.log"
    echo -e "  ${GREEN}Database:${NC}       ${DATA_DIR}/panel.db"
    echo ""
    echo -e "  ${YELLOW}Management Commands:${NC}"
    echo -e "    Start:     sudo ${INSTALL_DIR}/start.sh"
    echo -e "    Stop:      sudo ${INSTALL_DIR}/stop.sh"
    echo -e "    Restart:   sudo ${INSTALL_DIR}/restart.sh"
    echo -e "    Update:    sudo ${INSTALL_DIR}/update.sh"
    echo -e "    Uninstall: sudo ${INSTALL_DIR}/uninstall.sh"
    echo ""
    if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
        echo -e "  ${YELLOW}Systemd:${NC}"
        echo -e "    sudo systemctl start ${SERVICE_NAME}"
        echo -e "    sudo systemctl stop ${SERVICE_NAME}"
        echo -e "    sudo systemctl status ${SERVICE_NAME}"
        echo -e "    sudo journalctl -u ${SERVICE_NAME} -f"
    fi
    echo ""
    echo -e "  ${RED}IMPORTANT: Change the default admin password after first login!${NC}"
    echo -e "${CYAN}============================================================${NC}"
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
    echo -e "${CYAN}"
    echo "  ╦  ╦╦╔═╗╔═╗╔═╗╦ ╦╔═╗  ╦  ╦╔═╗╔╗  ╔═╗╔╦╗"
    echo "  ╚╗╔╝║╠═╝╠═╝║  ╠═╣╚═╗  ╚╗╔╝║ ║╠╩╗ ║╣  ║║"
    echo "   ╚╝ ╩╩  ╩  ╚═╝╩ ╩╚═╝   ╚╝ ╚═╝╚═╝╚═╝╚═╝╚╩╝"
    echo -e "${NC}"

    check_root
    detect_distro
    detect_pkg_manager
    install_dependencies
    check_python
    install_docker
    install_nodejs
    create_directories
    copy_files
    setup_venv
    generate_env
    prompt_admin
    setup_docker_network

    # Try systemd first, fall back to screen
    if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
        setup_systemd
    else
        warn "systemd not available. Using screen/tmux supervisor."
        setup_screen_supervisor
    fi

    create_management_scripts
    create_admin_user
    print_summary

    # Start the service
    if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null 2>&1; then
        systemctl start ${SERVICE_NAME}
        log "NexPanel service started."
    else
        if command -v screen &>/dev/null; then
            mkdir -p "${INSTALL_DIR}/logs"
            screen -dmS nexpanel bash "${INSTALL_DIR}/run.sh"
            log "NexPanel started in screen session."
        elif command -v tmux &>/dev/null; then
            mkdir -p "${INSTALL_DIR}/logs"
            tmux new-session -d -s nexpanel "bash ${INSTALL_DIR}/run.sh"
            log "NexPanel started in tmux session."
        else
            log "No screen/tmux found. Start manually: ${INSTALL_DIR}/run.sh"
        fi
    fi
}

main "$@"
