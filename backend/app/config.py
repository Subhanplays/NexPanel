from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "NexPanel"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    API_PREFIX: str = "/api/v1"
    ALLOWED_HOSTS: list[str] = ["*"]

    DATABASE_URL: str = "sqlite+aiosqlite:///./vps_panel.db"
    DB_ECHO: bool = False

    JWT_SECRET_KEY: str = "change-me-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DOCKER_HOST: str = "unix:///var/run/docker.sock"
    DOCKER_TLS_VERIFY: bool = False
    DOCKER_CERT_PATH: Optional[str] = None
    DOCKER_API_VERSION: str = "auto"
    DOCKER_NETWORK: str = "vps-network"
    DOCKER_SUBNET: str = "172.20.0.0/16"
    DOCKER_IMAGE_BUILD_TIMEOUT: int = 600
    DOCKER_CONTAINER_START_TIMEOUT: int = 120
    DOCKER_DATA_DIR: str = "/var/lib/vps-panel/data"

    IP_POOL_SUBNET: str = "10.0.0.0/24"
    IP_POOL_GATEWAY: str = "10.0.0.1"
    IP_POOL_DNS: str = "8.8.8.8,8.8.4.4"
    IP_POOL_INTERFACE: str = "eth0"

    TAILSCALE_AUTH_KEY: Optional[str] = None
    TAILSCALE_API_KEY: Optional[str] = None
    TAILSCALE_NETWORK: str = "100.64.0.0/10"
    TAILSCALE_TIMEOUT: int = 30

    TMATE_SERVER: str = "tmate.io"
    TMATE_TIMEOUT: int = 30

    SSHX_SERVER: Optional[str] = None
    SSHX_TIMEOUT: int = 30

    DISCORD_BOT_TOKEN: Optional[str] = None
    DISCORD_GUILD_ID: Optional[int] = None
    DISCORD_WEBHOOK_URL: Optional[str] = None

    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@vpspanel.local"

    BRAND_NAME: str = "NexPanel"
    BRAND_LOGO_URL: Optional[str] = None
    BRAND_COLOR: str = "#3b82f6"
    BRAND_FOOTER: str = "Powered by NexPanel"

    MAX_VPS_PER_USER: int = 10
    MAX_CPU_CORES: int = 8
    MAX_RAM_GB: int = 32
    MAX_DISK_GB: int = 500
    DEFAULT_CPU_CORES: int = 1
    DEFAULT_RAM_GB: int = 1
    DEFAULT_DISK_GB: int = 20

    AUDIT_LOG_ENABLED: bool = True
    AUDIT_LOG_RETENTION_DAYS: int = 90

    MONITORING_INTERVAL: int = 60
    ANTI_MINER_ENABLED: bool = True
    ANTI_MINER_CHECK_INTERVAL: int = 300

    ADMIN_API_KEY: Optional[str] = None
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
