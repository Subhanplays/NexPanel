import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, hash_password
from app.models.models import APIKey, IPv4Address, User, VPS
from app.schemas.schemas import (
    APIKeyCreate,
    APIKeyCreatedResponse,
    APIKeyResponse,
    ChangePasswordRequest,
    MessageResponse,
    UserResponse,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_admin:
        total_vps = (await db.execute(select(func.count(VPS.id)))).scalar() or 0
        running = (await db.execute(
            select(func.count(VPS.id)).where(VPS.status == "running")
        )).scalar() or 0
        stopped = (await db.execute(
            select(func.count(VPS.id)).where(VPS.status == "stopped")
        )).scalar() or 0
        total_cpu = (await db.execute(select(func.coalesce(func.sum(VPS.cpu_cores), 0)))).scalar() or 0
        total_ram = (await db.execute(select(func.coalesce(func.sum(VPS.memory_gb), 0)))).scalar() or 0
        total_disk = (await db.execute(select(func.coalesce(func.sum(VPS.disk_gb), 0)))).scalar() or 0
        total_ipv4 = (await db.execute(select(func.count(IPv4Address.id)))).scalar() or 0
    else:
        total_vps = (await db.execute(
            select(func.count(VPS.id)).where(VPS.user_id == current_user.id)
        )).scalar() or 0
        running = (await db.execute(
            select(func.count(VPS.id)).where(VPS.user_id == current_user.id, VPS.status == "running")
        )).scalar() or 0
        stopped = (await db.execute(
            select(func.count(VPS.id)).where(VPS.user_id == current_user.id, VPS.status == "stopped")
        )).scalar() or 0
        total_cpu = (await db.execute(
            select(func.coalesce(func.sum(VPS.cpu_cores), 0)).where(VPS.user_id == current_user.id)
        )).scalar() or 0
        total_ram = (await db.execute(
            select(func.coalesce(func.sum(VPS.memory_gb), 0)).where(VPS.user_id == current_user.id)
        )).scalar() or 0
        total_disk = (await db.execute(
            select(func.coalesce(func.sum(VPS.disk_gb), 0)).where(VPS.user_id == current_user.id)
        )).scalar() or 0
        total_ipv4 = (await db.execute(
            select(func.count(IPv4Address.id)).where(IPv4Address.user_id == current_user.id)
        )).scalar() or 0

    return {
        "total_vps": total_vps,
        "running": running,
        "stopped": stopped,
        "total_cpu": total_cpu,
        "total_ram": total_ram,
        "total_disk": total_disk,
        "total_bandwidth": 0,
        "total_ipv4": total_ipv4,
    }


# ── User Settings ──────────────────────────────────────────

settings_router = APIRouter(prefix="/settings", tags=["Settings"])


@settings_router.put("/profile", response_model=UserResponse)
async def update_profile(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if "username" in body:
        existing = await db.execute(
            select(User).where(User.username == body["username"], User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")
        current_user.username = body["username"]

    if "email" in body:
        existing = await db.execute(
            select(User).where(User.email == body["email"], User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already taken")
        current_user.email = body["email"]

    await db.flush()
    return current_user


@settings_router.put("/password", response_model=MessageResponse)
async def update_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.middleware.auth import verify_password
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(body.new_password)
    await db.flush()
    return MessageResponse(message="Password updated successfully")


@settings_router.get("/api-keys", response_model=list[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == current_user.id)
    )
    return result.scalars().all()


@settings_router.post("/api-keys", response_model=APIKeyCreatedResponse, status_code=201)
async def create_api_key(
    body: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_key = secrets.token_hex(32)
    key_hash = hash_password(raw_key)
    key_prefix = raw_key[:12]

    api_key = APIKey(
        user_id=current_user.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        name=body.name,
        permissions=body.permissions,
        expires_at=body.expires_at,
    )
    db.add(api_key)
    await db.flush()

    return APIKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        permissions=api_key.permissions,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
        last_used=api_key.last_used,
        key=raw_key,
    )


@settings_router.delete("/api-keys/{key_id}", response_model=MessageResponse)
async def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    await db.delete(api_key)
    await db.flush()
    return MessageResponse(message="API key deleted")
