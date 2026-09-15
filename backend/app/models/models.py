import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Float,
    JSON,
    Index,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    vps_limit = Column(Integer, default=10, nullable=False)
    cpu_limit = Column(Integer, default=8, nullable=False)
    ram_limit = Column(Integer, default=32, nullable=False)
    disk_limit = Column(Integer, default=500, nullable=False)
    ipv4_limit = Column(Integer, default=5, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    vps_instances = relationship("VPS", back_populates="user", cascade="all, delete-orphan")
    ipv4_addresses = relationship("IPv4Address", back_populates="user", cascade="all, delete-orphan")
    deployments = relationship("Deployment", back_populates="user", cascade="all, delete-orphan")
    terminal_sessions = relationship("TerminalSession", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")


class VPS(Base):
    __tablename__ = "vps_instances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vps_id = Column(String(36), unique=True, default=generate_uuid, nullable=False, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    container_id = Column(String(64), nullable=True, index=True)
    host_id = Column(Integer, ForeignKey("hosts.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(100), nullable=False)
    memory_gb = Column(Integer, default=1, nullable=False)
    cpu_cores = Column(Integer, default=1, nullable=False)
    disk_gb = Column(Integer, default=20, nullable=False)
    username = Column(String(50), default="root", nullable=False)
    password_hash = Column(String(255), nullable=True)
    root_password_hash = Column(String(255), nullable=True)
    os_image = Column(String(100), default="ubuntu:22.04", nullable=False)
    status = Column(String(20), default="creating", nullable=False, index=True)
    ipv4_id = Column(Integer, ForeignKey("ipv4_addresses.id", ondelete="SET NULL"), nullable=True)
    tailscale_ip = Column(String(45), nullable=True)
    tmate_session = Column(Text, nullable=True)
    sshx_session = Column(Text, nullable=True)
    restart_count = Column(Integer, default=0, nullable=False)
    last_restart = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="vps_instances")
    ipv4_address = relationship("IPv4Address", foreign_keys="VPS.ipv4_id", primaryjoin="VPS.ipv4_id==IPv4Address.id", uselist=False)
    host = relationship("Host", back_populates="vps_instances")
    deployments = relationship("Deployment", back_populates="vps", cascade="all, delete-orphan")
    terminal_sessions = relationship("TerminalSession", back_populates="vps", cascade="all, delete-orphan")
    tailscale_node = relationship("TailscaleNode", back_populates="vps", uselist=False)
    tmate_session_record = relationship("TmateSession", back_populates="vps", uselist=False)
    sshx_session_record = relationship("SSHXSession", back_populates="vps", uselist=False)


class IPv4Address(Base):
    __tablename__ = "ipv4_addresses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_address = Column(String(45), unique=True, nullable=False, index=True)
    subnet = Column(String(18), nullable=False)
    gateway = Column(String(45), nullable=False)
    dns = Column(String(100), nullable=False)
    status = Column(String(20), default="available", nullable=False, index=True)
    vps_id = Column(Integer, ForeignKey("vps_instances.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reserved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    released_at = Column(DateTime, nullable=True)

    vps = relationship("VPS", foreign_keys="IPv4Address.vps_id", primaryjoin="IPv4Address.vps_id==VPS.id", viewonly=True)
    user = relationship("User", back_populates="ipv4_addresses")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vps_id = Column(Integer, ForeignKey("vps_instances.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending", nullable=False, index=True)
    progress = Column(Integer, default=0, nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    vps = relationship("VPS", back_populates="deployments")
    user = relationship("User", back_populates="deployments")


class TerminalSession(Base):
    __tablename__ = "terminal_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vps_id = Column(Integer, ForeignKey("vps_instances.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(36), unique=True, default=generate_uuid, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_active = Column(DateTime, default=utcnow, nullable=False)

    vps = relationship("VPS", back_populates="terminal_sessions")
    user = relationship("User", back_populates="terminal_sessions")


class TailscaleNode(Base):
    __tablename__ = "tailscale_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vps_id = Column(Integer, ForeignKey("vps_instances.id", ondelete="CASCADE"), nullable=False, unique=True)
    node_id = Column(String(100), unique=True, nullable=True)
    hostname = Column(String(255), nullable=True)
    ip = Column(String(45), nullable=True)
    auth_key = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    vps = relationship("VPS", back_populates="tailscale_node")


class TmateSession(Base):
    __tablename__ = "tmate_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vps_id = Column(Integer, ForeignKey("vps_instances.id", ondelete="CASCADE"), nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_string = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    vps = relationship("VPS", back_populates="tmate_session_record")


class SSHXSession(Base):
    __tablename__ = "sshx_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vps_id = Column(Integer, ForeignKey("vps_instances.id", ondelete="CASCADE"), nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_url = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    vps = relationship("VPS", back_populates="sshx_session_record")


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    docker_image = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class Host(Base):
    __tablename__ = "hosts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    hostname = Column(String(255), nullable=False)
    ip_address = Column(String(45), nullable=False)
    status = Column(String(20), default="active", nullable=False, index=True)
    max_containers = Column(Integer, default=50, nullable=False)
    current_containers = Column(Integer, default=0, nullable=False)
    api_key = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    vps_instances = relationship("VPS", back_populates="host")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    key_prefix = Column(String(16), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    permissions = Column(JSON, default=list, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_used = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True, index=True)
    resource_id = Column(String(100), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="audit_logs")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(200), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    category = Column(String(50), default="general", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class BrandingSetting(Base):
    __tablename__ = "branding_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(200), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    category = Column(String(50), default="appearance", nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
