from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, Field


# ── Auth Schemas ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ── User Schemas ──────────────────────────────────────────────
class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    is_admin: bool = False
    is_active: bool = True
    vps_limit: int = 10
    cpu_limit: int = 8
    ram_limit: int = 32
    disk_limit: int = 500
    ipv4_limit: int = 5


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    vps_limit: Optional[int] = None
    cpu_limit: Optional[int] = None
    ram_limit: Optional[int] = None
    disk_limit: Optional[int] = None
    ipv4_limit: Optional[int] = None


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_admin: bool
    is_active: bool
    vps_limit: int
    cpu_limit: int
    ram_limit: int
    disk_limit: int
    ipv4_limit: int
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── VPS Schemas ───────────────────────────────────────────────
class VPSCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    memory_gb: int = Field(default=1, ge=1, le=32)
    cpu_cores: int = Field(default=1, ge=1, le=8)
    disk_gb: int = Field(default=20, ge=10, le=500)
    os_image: str = "ubuntu:22.04"
    username: str = Field(default="root", min_length=1, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    root_password: Optional[str] = None
    assign_ipv4: bool = True
    enable_tailscale: bool = False
    enable_tmate: bool = True
    enable_sshx: bool = False


class VPSUpdate(BaseModel):
    name: Optional[str] = None
    memory_gb: Optional[int] = None
    cpu_cores: Optional[int] = None
    disk_gb: Optional[int] = None


class VPSResponse(BaseModel):
    id: int
    vps_id: str
    user_id: int
    container_id: Optional[str] = None
    name: str
    memory_gb: int
    cpu_cores: int
    disk_gb: int
    username: str
    os_image: str
    status: str
    ipv4_id: Optional[int] = None
    tailscale_ip: Optional[str] = None
    tmate_session: Optional[str] = None
    sshx_session: Optional[str] = None
    ssh_port: int = 22
    restart_count: int
    last_restart: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VPSTokenResponse(BaseModel):
    vps_id: str
    token: str
    ip_address: Optional[str] = None
    username: str
    status: str


class VPSMetrics(BaseModel):
    cpu_percent: float
    memory_used_mb: int
    memory_limit_mb: int
    memory_percent: float
    disk_used_gb: float
    disk_total_gb: float
    disk_percent: float
    network_rx_bytes: int
    network_tx_bytes: int
    uptime_seconds: int
    pids: int


# ── IPv4 Schemas ──────────────────────────────────────────────
class IPv4Create(BaseModel):
    ip_address: str
    subnet: str = "255.255.255.0"
    gateway: str
    dns: str = "8.8.8.8,8.8.4.4"


class IPv4Response(BaseModel):
    id: int
    ip_address: str
    subnet: str
    gateway: str
    dns: str
    status: str
    vps_id: Optional[int] = None
    user_id: Optional[int] = None
    reserved: bool
    created_at: datetime
    released_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class IPv4BulkCreate(BaseModel):
    start_ip: str
    count: int = Field(ge=1, le=256)
    subnet: str = "255.255.255.0"
    gateway: str
    dns: str = "8.8.8.8,8.8.4.4"


# ── Deployment Schemas ───────────────────────────────────────
class DeploymentResponse(BaseModel):
    id: int
    vps_id: int
    user_id: int
    status: str
    progress: int
    message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Terminal Schemas ─────────────────────────────────────────
class TerminalSessionResponse(BaseModel):
    session_id: str
    vps_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Tailscale Schemas ────────────────────────────────────────
class TailscaleStatus(BaseModel):
    ip: Optional[str] = None
    hostname: Optional[str] = None
    status: str


class TailscaleNodeResponse(BaseModel):
    id: int
    vps_id: int
    node_id: Optional[str] = None
    hostname: Optional[str] = None
    ip: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── tmate/SSHX Schemas ──────────────────────────────────────
class TmateSessionResponse(BaseModel):
    session_string: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None


class SSHXSessionResponse(BaseModel):
    session_url: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None


# ── Image Schemas ────────────────────────────────────────────
class ImageCreate(BaseModel):
    name: str
    docker_image: str
    description: Optional[str] = None
    is_active: bool = True


class ImageUpdate(BaseModel):
    name: Optional[str] = None
    docker_image: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ImageResponse(BaseModel):
    id: int
    name: str
    docker_image: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Host Schemas ─────────────────────────────────────────────
class HostCreate(BaseModel):
    name: str
    hostname: str
    ip_address: str
    max_containers: int = 50
    api_key: str


class HostUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    status: Optional[str] = None
    max_containers: Optional[int] = None


class HostResponse(BaseModel):
    id: int
    name: str
    hostname: str
    ip_address: str
    status: str
    max_containers: int
    current_containers: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── API Key Schemas ──────────────────────────────────────────
class APIKeyCreate(BaseModel):
    name: str
    permissions: list[str] = []
    expires_at: Optional[datetime] = None


class APIKeyResponse(BaseModel):
    id: int
    name: str
    permissions: list[str]
    expires_at: Optional[datetime] = None
    created_at: datetime
    last_used: Optional[datetime] = None

    model_config = {"from_attributes": True}


class APIKeyCreatedResponse(APIKeyResponse):
    key: str


# ── Audit Log Schemas ────────────────────────────────────────
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── System Setting Schemas ───────────────────────────────────
class SystemSettingCreate(BaseModel):
    key: str
    value: Optional[str] = None
    category: str = "general"


class SystemSettingUpdate(BaseModel):
    value: Optional[str] = None
    category: Optional[str] = None


class SystemSettingResponse(BaseModel):
    id: int
    key: str
    value: Optional[str] = None
    category: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Branding Setting Schemas ─────────────────────────────────
class BrandingSettingCreate(BaseModel):
    key: str
    value: Optional[str] = None
    category: str = "appearance"


class BrandingSettingUpdate(BaseModel):
    value: Optional[str] = None
    category: Optional[str] = None


class BrandingSettingResponse(BaseModel):
    id: int
    key: str
    value: Optional[str] = None
    category: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Pagination / Generic ─────────────────────────────────────
class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    per_page: int
    pages: int


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    docker: str


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
