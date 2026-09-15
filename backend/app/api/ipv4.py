import ipaddress
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_admin_user, get_current_user
from app.models.models import AuditLog, IPv4Address, User, VPS
from app.schemas.schemas import (
    IPv4BulkCreate,
    IPv4Create,
    IPv4Response,
    MessageResponse,
)

router = APIRouter(prefix="/ipv4", tags=["IPv4 Pool"])


@router.get("/", response_model=list[IPv4Response])
async def list_ipv4(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(IPv4Address)
    if not current_user.is_admin:
        query = query.where(IPv4Address.user_id == current_user.id)
    if status_filter:
        query = query.where(IPv4Address.status == status_filter)
    query = query.order_by(IPv4Address.ip_address)
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=IPv4Response, status_code=201)
async def add_ipv4(
    body: IPv4Create,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(IPv4Address).where(IPv4Address.ip_address == body.ip_address)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="IP address already exists")

    try:
        ipaddress.ip_address(body.ip_address)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address")

    ipv4 = IPv4Address(
        ip_address=body.ip_address,
        subnet=body.subnet,
        gateway=body.gateway,
        dns=body.dns,
    )
    db.add(ipv4)
    db.add(AuditLog(
        user_id=admin.id,
        action="admin_add_ipv4",
        resource_type="ipv4",
        resource_id=body.ip_address,
    ))
    await db.flush()
    return ipv4


@router.post("/bulk", response_model=list[IPv4Response], status_code=201)
async def bulk_add_ipv4(
    body: IPv4BulkCreate,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        start = ipaddress.ip_address(body.start_ip)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start IP address")

    added = []
    for i in range(body.count):
        ip = str(start + i)
        existing = await db.execute(
            select(IPv4Address).where(IPv4Address.ip_address == ip)
        )
        if existing.scalar_one_or_none():
            continue

        ipv4 = IPv4Address(
            ip_address=ip,
            subnet=body.subnet,
            gateway=body.gateway,
            dns=body.dns,
        )
        db.add(ipv4)
        added.append(ipv4)

    if added:
        db.add(AuditLog(
            user_id=admin.id,
            action="admin_bulk_add_ipv4",
            resource_type="ipv4",
            resource_id=f"{len(added)} addresses",
            details={"start": body.start_ip, "count": len(added)},
        ))
    await db.flush()
    return added


@router.delete("/{ipv4_id}", response_model=MessageResponse)
async def remove_ipv4(
    ipv4_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IPv4Address).where(IPv4Address.id == ipv4_id)
    )
    ipv4 = result.scalar_one_or_none()
    if not ipv4:
        raise HTTPException(status_code=404, detail="IP address not found")
    if ipv4.status == "assigned":
        raise HTTPException(
            status_code=400,
            detail="Cannot remove assigned IP. Release it first.",
        )

    db.add(AuditLog(
        user_id=admin.id,
        action="admin_remove_ipv4",
        resource_type="ipv4",
        resource_id=ipv4.ip_address,
    ))
    await db.delete(ipv4)
    await db.flush()
    return MessageResponse(message="IP address removed")


@router.post("/{ipv4_id}/reserve", response_model=IPv4Response)
async def reserve_ipv4(
    ipv4_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IPv4Address).where(IPv4Address.id == ipv4_id)
    )
    ipv4 = result.scalar_one_or_none()
    if not ipv4:
        raise HTTPException(status_code=404, detail="IP address not found")
    if ipv4.status == "assigned":
        raise HTTPException(status_code=400, detail="Cannot reserve assigned IP")

    ipv4.reserved = True
    db.add(AuditLog(
        user_id=admin.id,
        action="admin_reserve_ipv4",
        resource_type="ipv4",
        resource_id=ipv4.ip_address,
    ))
    await db.flush()
    return ipv4


@router.post("/{ipv4_id}/unreserve", response_model=IPv4Response)
async def unreserve_ipv4(
    ipv4_id: int,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IPv4Address).where(IPv4Address.id == ipv4_id)
    )
    ipv4 = result.scalar_one_or_none()
    if not ipv4:
        raise HTTPException(status_code=404, detail="IP address not found")

    ipv4.reserved = False
    db.add(AuditLog(
        user_id=admin.id,
        action="admin_unreserve_ipv4",
        resource_type="ipv4",
        resource_id=ipv4.ip_address,
    ))
    await db.flush()
    return ipv4


@router.post("/{ipv4_id}/assign", response_model=IPv4Response)
async def assign_ipv4(
    ipv4_id: int,
    vps_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IPv4Address).where(IPv4Address.id == ipv4_id)
    )
    ipv4 = result.scalar_one_or_none()
    if not ipv4:
        raise HTTPException(status_code=404, detail="IP address not found")
    if ipv4.status != "available":
        raise HTTPException(status_code=400, detail="IP is not available")
    if ipv4.reserved:
        raise HTTPException(status_code=400, detail="IP is reserved")

    vps_result = await db.execute(select(VPS).where(VPS.id == vps_id))
    vps = vps_result.scalar_one_or_none()
    if not vps:
        raise HTTPException(status_code=404, detail="VPS not found")
    if not current_user.is_admin and vps.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    ipv4.vps_id = vps.id
    ipv4.user_id = vps.user_id
    ipv4.status = "assigned"
    vps.ipv4_id = ipv4.id

    db.add(AuditLog(
        user_id=current_user.id,
        action="assign_ipv4",
        resource_type="ipv4",
        resource_id=ipv4.ip_address,
        details={"vps_id": vps.vps_id},
    ))
    await db.flush()
    return ipv4


@router.post("/{ipv4_id}/release", response_model=IPv4Response)
async def release_ipv4(
    ipv4_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(IPv4Address).where(IPv4Address.id == ipv4_id)
    )
    ipv4 = result.scalar_one_or_none()
    if not ipv4:
        raise HTTPException(status_code=404, detail="IP address not found")
    if ipv4.status != "assigned":
        raise HTTPException(status_code=400, detail="IP is not assigned")
    if not current_user.is_admin and ipv4.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if ipv4.vps_id:
        vps_result = await db.execute(select(VPS).where(VPS.id == ipv4.vps_id))
        vps = vps_result.scalar_one_or_none()
        if vps:
            vps.ipv4_id = None

    ipv4.vps_id = None
    ipv4.user_id = None
    ipv4.status = "available"
    ipv4.released_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        user_id=current_user.id,
        action="release_ipv4",
        resource_type="ipv4",
        resource_id=ipv4.ip_address,
    ))
    await db.flush()
    return ipv4
