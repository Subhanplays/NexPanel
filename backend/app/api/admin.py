from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_admin_user, hash_password
from app.models.models import (
    AuditLog,
    BrandingSetting,
    Host,
    IPv4Address,
    Image,
    SystemSetting,
    User,
    VPS,
)
from app.schemas.schemas import (
    BrandingSettingCreate,
    BrandingSettingResponse,
    BrandingSettingUpdate,
    HostCreate,
    HostResponse,
    HostUpdate,
    ImageCreate,
    ImageResponse,
    ImageUpdate,
    MessageResponse,
    PaginatedResponse,
    SystemSettingCreate,
    SystemSettingResponse,
    SystemSettingUpdate,
    UserCreate,
    UserResponse,
    UserUpdate,
    AuditLogResponse,
    IPv4Response,
    VPSResponse,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── User Management ───────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if search:
        query = query.where(
            (User.username.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )
    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(User).where((User.email == body.email) | (User.username == body.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email or username already taken")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        is_admin=body.is_admin,
        is_active=body.is_active,
        vps_limit=body.vps_limit,
        cpu_limit=body.cpu_limit,
        ram_limit=body.ram_limit,
        disk_limit=body.disk_limit,
        ipv4_limit=body.ipv4_limit,
    )
    db.add(user)
    db.add(AuditLog(
        user_id=admin.id,
        action="admin_create_user",
        resource_type="user",
        resource_id=body.username,
    ))
    await db.flush()
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_update_user",
        resource_type="user",
        resource_id=str(user_id),
        details=update_data,
    ))
    await db.flush()
    return user


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_delete_user",
        resource_type="user",
        resource_id=str(user_id),
    ))
    await db.delete(user)
    await db.flush()
    return MessageResponse(message="User deleted")


# ── VPS Management ───────────────────────────────────────────

@router.get("/vps", response_model=list[VPSResponse])
async def admin_list_vps(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    user_id: Optional[int] = None,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(VPS)
    if status_filter:
        query = query.where(VPS.status == status_filter)
    if user_id:
        query = query.where(VPS.user_id == user_id)
    query = query.order_by(VPS.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/vps/stats")
async def vps_stats(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    total = await db.execute(select(func.count(VPS.id)))
    running = await db.execute(
        select(func.count(VPS.id)).where(VPS.status == "running")
    )
    stopped = await db.execute(
        select(func.count(VPS.id)).where(VPS.status == "stopped")
    )
    total_cpu = await db.execute(select(func.coalesce(func.sum(VPS.cpu_cores), 0)))
    total_ram = await db.execute(select(func.coalesce(func.sum(VPS.memory_gb), 0)))
    total_disk = await db.execute(select(func.coalesce(func.sum(VPS.disk_gb), 0)))

    return {
        "total_vps": total.scalar() or 0,
        "running": running.scalar() or 0,
        "stopped": stopped.scalar() or 0,
        "total_cpu_cores": total_cpu.scalar() or 0,
        "total_ram_gb": total_ram.scalar() or 0,
        "total_disk_gb": total_disk.scalar() or 0,
    }


# ── System Settings ──────────────────────────────────────────

@router.get("/settings", response_model=list[SystemSettingResponse])
async def list_settings(
    category: Optional[str] = None,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(SystemSetting)
    if category:
        query = query.where(SystemSetting.category == category)
    result = await db.execute(query.order_by(SystemSetting.key))
    return result.scalars().all()


@router.post("/settings", response_model=SystemSettingResponse, status_code=201)
async def create_setting(
    body: SystemSettingCreate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(SystemSetting).where(SystemSetting.key == body.key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Setting key already exists")

    setting = SystemSetting(
        key=body.key,
        value=body.value,
        category=body.category,
    )
    db.add(setting)
    db.add(AuditLog(
        user_id=admin.id,
        action="admin_create_setting",
        resource_type="system_setting",
        resource_id=body.key,
    ))
    await db.flush()
    return setting


@router.put("/settings/{setting_id}", response_model=SystemSettingResponse)
async def update_setting(
    setting_id: int,
    body: SystemSettingUpdate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.id == setting_id)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    if body.value is not None:
        setting.value = body.value
    if body.category is not None:
        setting.category = body.category
    setting.updated_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_update_setting",
        resource_type="system_setting",
        resource_id=setting.key,
    ))
    await db.flush()
    return setting


@router.delete("/settings/{setting_id}", response_model=MessageResponse)
async def delete_setting(
    setting_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.id == setting_id)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_delete_setting",
        resource_type="system_setting",
        resource_id=setting.key,
    ))
    await db.delete(setting)
    await db.flush()
    return MessageResponse(message="Setting deleted")


# ── Branding Settings ────────────────────────────────────────

@router.get("/branding", response_model=list[BrandingSettingResponse])
async def list_branding(
    category: Optional[str] = None,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(BrandingSetting)
    if category:
        query = query.where(BrandingSetting.category == category)
    result = await db.execute(query.order_by(BrandingSetting.key))
    return result.scalars().all()


@router.post("/branding", response_model=BrandingSettingResponse, status_code=201)
async def create_branding(
    body: BrandingSettingCreate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(BrandingSetting).where(BrandingSetting.key == body.key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Branding key already exists")

    branding = BrandingSetting(
        key=body.key,
        value=body.value,
        category=body.category,
    )
    db.add(branding)
    db.add(AuditLog(
        user_id=admin.id,
        action="admin_create_branding",
        resource_type="branding_setting",
        resource_id=body.key,
    ))
    await db.flush()
    return branding


@router.put("/branding/{branding_id}", response_model=BrandingSettingResponse)
async def update_branding(
    branding_id: int,
    body: BrandingSettingUpdate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BrandingSetting).where(BrandingSetting.id == branding_id)
    )
    branding = result.scalar_one_or_none()
    if not branding:
        raise HTTPException(status_code=404, detail="Branding setting not found")

    if body.value is not None:
        branding.value = body.value
    if body.category is not None:
        branding.category = body.category
    branding.updated_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_update_branding",
        resource_type="branding_setting",
        resource_id=branding.key,
    ))
    await db.flush()
    return branding


@router.delete("/branding/{branding_id}", response_model=MessageResponse)
async def delete_branding(
    branding_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BrandingSetting).where(BrandingSetting.id == branding_id)
    )
    branding = result.scalar_one_or_none()
    if not branding:
        raise HTTPException(status_code=404, detail="Branding setting not found")

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_delete_branding",
        resource_type="branding_setting",
        resource_id=branding.key,
    ))
    await db.delete(branding)
    await db.flush()
    return MessageResponse(message="Branding setting deleted")


# ── Audit Logs ────────────────────────────────────────────────

@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    query = query.order_by(AuditLog.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return result.scalars().all()


# ── Image Management ─────────────────────────────────────────

@router.get("/images", response_model=list[ImageResponse])
async def list_images(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Image).order_by(Image.name))
    return result.scalars().all()


@router.post("/images", response_model=ImageResponse, status_code=201)
async def create_image(
    body: ImageCreate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    image = Image(
        name=body.name,
        docker_image=body.docker_image,
        description=body.description,
        is_active=body.is_active,
    )
    db.add(image)
    db.add(AuditLog(
        user_id=admin.id,
        action="admin_create_image",
        resource_type="image",
        resource_id=body.name,
    ))
    await db.flush()
    return image


@router.put("/images/{image_id}", response_model=ImageResponse)
async def update_image(
    image_id: int,
    body: ImageUpdate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(image, field, value)

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_update_image",
        resource_type="image",
        resource_id=str(image_id),
    ))
    await db.flush()
    return image


@router.delete("/images/{image_id}", response_model=MessageResponse)
async def delete_image(
    image_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_delete_image",
        resource_type="image",
        resource_id=str(image_id),
    ))
    await db.delete(image)
    await db.flush()
    return MessageResponse(message="Image deleted")


# ── Host Management ──────────────────────────────────────────

@router.get("/hosts", response_model=list[HostResponse])
async def list_hosts(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Host).order_by(Host.name))
    return result.scalars().all()


@router.post("/hosts", response_model=HostResponse, status_code=201)
async def create_host(
    body: HostCreate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Host).where(Host.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Host name already exists")

    host = Host(
        name=body.name,
        hostname=body.hostname,
        ip_address=body.ip_address,
        max_containers=body.max_containers,
        api_key=body.api_key,
    )
    db.add(host)
    db.add(AuditLog(
        user_id=admin.id,
        action="admin_create_host",
        resource_type="host",
        resource_id=body.name,
    ))
    await db.flush()
    return host


@router.put("/hosts/{host_id}", response_model=HostResponse)
async def update_host(
    host_id: int,
    body: HostUpdate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(host, field, value)

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_update_host",
        resource_type="host",
        resource_id=str(host_id),
    ))
    await db.flush()
    return host


@router.delete("/hosts/{host_id}", response_model=MessageResponse)
async def delete_host(
    host_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_delete_host",
        resource_type="host",
        resource_id=str(host_id),
    ))
    await db.delete(host)
    await db.flush()
    return MessageResponse(message="Host deleted")
