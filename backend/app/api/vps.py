import secrets
import shutil
import tempfile
import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user, hash_password
from app.models.models import (
    AuditLog,
    Deployment,
    Image,
    IPv4Address,
    VPS,
    User,
)
from app.schemas.schemas import (
    DeploymentResponse,
    ImageResponse,
    MessageResponse,
    VPSCreate,
    VPSMetrics,
    VPSResponse,
    VPSTokenResponse,
    VPSUpdate,
)
from app.services.vps_service import (
    delete_vps_container,
    exec_in_container,
    get_container_metrics,
    get_disk_usage,
    provision_vps,
    reinstall_vps,
    restart_vps,
    start_vps,
    stop_vps,
)

router = APIRouter(prefix="/vps", tags=["VPS"])


@router.get("/images", response_model=list[ImageResponse])
async def list_images_public(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Image).where(Image.is_active == True).order_by(Image.name)
    )
    return result.scalars().all()


async def _get_user_vps(vps_id: str, user: User, db: AsyncSession) -> VPS:
    result = await db.execute(
        select(VPS).where(VPS.vps_id == vps_id)
    )
    vps = result.scalar_one_or_none()
    if not vps:
        raise HTTPException(status_code=404, detail="VPS not found")
    if not user.is_admin and vps.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return vps


@router.get("/", response_model=list[VPSResponse])
async def list_vps(
    page: int = 1,
    per_page: int = 20,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(VPS)
    if not current_user.is_admin:
        query = query.where(VPS.user_id == current_user.id)
    if status_filter:
        query = query.where(VPS.status == status_filter)
    query = query.order_by(VPS.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=VPSResponse, status_code=201)
async def create_vps(
    body: VPSCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps_count = await db.execute(
        select(func.count(VPS.id)).where(VPS.user_id == current_user.id)
    )
    count = vps_count.scalar() or 0
    if count >= current_user.vps_limit:
        raise HTTPException(
            status_code=400,
            detail=f"VPS limit reached ({current_user.vps_limit})",
        )

    total_cpu = await db.execute(
        select(func.coalesce(func.sum(VPS.cpu_cores), 0)).where(VPS.user_id == current_user.id)
    )
    if (total_cpu.scalar() or 0) + body.cpu_cores > current_user.cpu_limit:
        raise HTTPException(status_code=400, detail="CPU limit exceeded")

    total_ram = await db.execute(
        select(func.coalesce(func.sum(VPS.memory_gb), 0)).where(VPS.user_id == current_user.id)
    )
    if (total_ram.scalar() or 0) + body.memory_gb > current_user.ram_limit:
        raise HTTPException(status_code=400, detail="RAM limit exceeded")

    total_disk = await db.execute(
        select(func.coalesce(func.sum(VPS.disk_gb), 0)).where(VPS.user_id == current_user.id)
    )
    if (total_disk.scalar() or 0) + body.disk_gb > current_user.disk_limit:
        raise HTTPException(status_code=400, detail="Disk limit exceeded")

    token = secrets.token_hex(32)
    vps = VPS(
        user_id=current_user.id,
        token=token,
        name=body.name,
        memory_gb=body.memory_gb,
        cpu_cores=body.cpu_cores,
        disk_gb=body.disk_gb,
        username=body.username,
        password_hash=hash_password(body.password),
        root_password_hash=hash_password(body.root_password) if body.root_password else None,
        os_image=body.os_image,
        status="creating",
    )
    db.add(vps)
    await db.flush()

    db.add(AuditLog(
        user_id=current_user.id,
        action="vps_create",
        resource_type="vps",
        resource_id=vps.vps_id,
        details={"name": body.name, "memory_gb": body.memory_gb, "cpu_cores": body.cpu_cores},
    ))
    await db.flush()

    asyncio.create_task(
        _provision_vps_background(
            vps.id,
            body.password,
            body.assign_ipv4,
            body.enable_tailscale,
            body.enable_tmate,
            body.enable_sshx,
        )
    )

    return vps


async def _provision_vps_background(
    vps_id: int,
    password: str,
    assign_ipv4: bool,
    enable_tailscale: bool,
    enable_tmate: bool,
    enable_sshx: bool,
):
    from app.database import async_session_maker

    async with async_session_maker() as db:
        result = await db.execute(select(VPS).where(VPS.id == vps_id))
        vps = result.scalar_one_or_none()
        if not vps:
            return
        try:
            await provision_vps(
                db=db,
                vps=vps,
                password=password,
                assign_ipv4=assign_ipv4,
                enable_tailscale=enable_tailscale,
                enable_tmate=enable_tmate,
                enable_sshx=enable_sshx,
            )
        except Exception as e:
            vps.status = "error"
            await db.commit()


@router.get("/{vps_id}", response_model=VPSResponse)
async def get_vps(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_user_vps(vps_id, current_user, db)


@router.put("/{vps_id}", response_model=VPSResponse)
async def update_vps(
    vps_id: str,
    body: VPSUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)

    if body.name is not None:
        vps.name = body.name
    if body.memory_gb is not None:
        vps.memory_gb = body.memory_gb
    if body.cpu_cores is not None:
        vps.cpu_cores = body.cpu_cores
    if body.disk_gb is not None:
        vps.disk_gb = body.disk_gb

    vps.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="vps_update",
        resource_type="vps",
        resource_id=vps_id,
    ))
    await db.flush()

    return vps


@router.delete("/{vps_id}", response_model=MessageResponse)
async def delete_vps(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)

    if vps.container_id:
        await delete_vps_container(vps.container_id)

    if vps.ipv4_id:
        result = await db.execute(
            select(IPv4Address).where(IPv4Address.id == vps.ipv4_id)
        )
        ipv4 = result.scalar_one_or_none()
        if ipv4:
            ipv4.status = "available"
            ipv4.vps_id = None
            ipv4.user_id = None
            ipv4.released_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        user_id=current_user.id,
        action="vps_delete",
        resource_type="vps",
        resource_id=vps_id,
    ))

    await db.delete(vps)
    await db.flush()

    return MessageResponse(message="VPS deleted")


@router.post("/{vps_id}/start", response_model=MessageResponse)
async def start_vps_route(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id:
        raise HTTPException(status_code=400, detail="No container attached")

    ok = await start_vps(vps.container_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to start VPS")

    vps.status = "running"
    vps.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="vps_start",
        resource_type="vps",
        resource_id=vps_id,
    ))
    await db.flush()

    return MessageResponse(message="VPS started")


@router.post("/{vps_id}/stop", response_model=MessageResponse)
async def stop_vps_route(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id:
        raise HTTPException(status_code=400, detail="No container attached")

    ok = await stop_vps(vps.container_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to stop VPS")

    vps.status = "stopped"
    vps.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="vps_stop",
        resource_type="vps",
        resource_id=vps_id,
    ))
    await db.flush()

    return MessageResponse(message="VPS stopped")


@router.post("/{vps_id}/restart", response_model=MessageResponse)
async def restart_vps_route(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id:
        raise HTTPException(status_code=400, detail="No container attached")

    ok = await restart_vps(vps.container_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to restart VPS")

    vps.status = "running"
    vps.restart_count += 1
    vps.last_restart = datetime.now(timezone.utc)
    vps.updated_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=current_user.id,
        action="vps_restart",
        resource_type="vps",
        resource_id=vps_id,
    ))
    await db.flush()

    return MessageResponse(message="VPS restarted")


@router.post("/{vps_id}/reinstall", response_model=MessageResponse)
async def reinstall_vps_route(
    vps_id: str,
    password: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)

    asyncio.create_task(_reinstall_background(vps.id, password))

    db.add(AuditLog(
        user_id=current_user.id,
        action="vps_reinstall",
        resource_type="vps",
        resource_id=vps_id,
    ))
    await db.flush()

    return MessageResponse(message="VPS reinstall started")


async def _reinstall_background(vps_id: int, password: str):
    from app.database import async_session_maker

    async with async_session_maker() as db:
        result = await db.execute(select(VPS).where(VPS.id == vps_id))
        vps = result.scalar_one_or_none()
        if not vps:
            return
        try:
            await reinstall_vps(db, vps, password)
        except Exception as e:
            vps.status = "error"
            await db.commit()


@router.get("/{vps_id}/metrics", response_model=VPSMetrics)
async def get_vps_metrics(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id:
        raise HTTPException(status_code=400, detail="No container attached")
    if vps.status != "running":
        raise HTTPException(status_code=400, detail="VPS is not running")

    metrics = await get_container_metrics(vps.container_id)
    if not metrics:
        raise HTTPException(status_code=500, detail="Failed to get metrics")

    disk = await get_disk_usage(vps.container_id)
    metrics["disk_used_gb"] = disk["used_gb"]
    metrics["disk_total_gb"] = disk["total_gb"]
    metrics["disk_percent"] = disk["percent"]

    return VPSMetrics(**metrics)


@router.get("/{vps_id}/token", response_model=VPSTokenResponse)
async def get_vps_token(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    ip = None
    if vps.ipv4_id:
        result = await db.execute(
            select(IPv4Address).where(IPv4Address.id == vps.ipv4_id)
        )
        ipv4 = result.scalar_one_or_none()
        if ipv4:
            ip = ipv4.ip_address

    return VPSTokenResponse(
        vps_id=vps.vps_id,
        token=vps.token,
        ip_address=ip,
        username=vps.username,
        status=vps.status,
    )


@router.get("/{vps_id}/deployments", response_model=list[DeploymentResponse])
async def list_deployments(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    result = await db.execute(
        select(Deployment)
        .where(Deployment.vps_id == vps.id)
        .order_by(Deployment.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{vps_id}/exec")
async def exec_command(
    vps_id: str,
    command: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id:
        raise HTTPException(status_code=400, detail="No container attached")
    if vps.status != "running":
        raise HTTPException(status_code=400, detail="VPS is not running")

    exit_code, output = await exec_in_container(vps.container_id, command)

    db.add(AuditLog(
        user_id=current_user.id,
        action="vps_exec",
        resource_type="vps",
        resource_id=vps_id,
        details={"command": command, "exit_code": exit_code},
    ))
    await db.flush()

    return {"exit_code": exit_code, "output": output}
