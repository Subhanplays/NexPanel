import ipaddress
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.models import IPv4Address, VPS

logger = logging.getLogger(__name__)


class IPPoolError(Exception):
    pass


class IPNotFoundError(IPPoolError):
    pass


class IPAlreadyExistsError(IPPoolError):
    pass


class IPAllocationError(IPPoolError):
    pass


class IPReleaseError(IPPoolError):
    pass


class IPPoolService:
    async def add_ip(
        self,
        ip_address: str,
        subnet: str,
        gateway: str,
        dns: str,
    ) -> IPv4Address:
        try:
            ipaddress.ip_address(ip_address)
            ipaddress.ip_address(gateway)
        except ValueError as e:
            raise IPPoolError(f"Invalid IP configuration: {e}")

        async with async_session_maker() as session:
            existing = await session.execute(
                select(IPv4Address).where(IPv4Address.ip_address == ip_address)
            )
            if existing.scalar_one_or_none():
                raise IPAlreadyExistsError(f"IP {ip_address} already exists in pool")

            ip = IPv4Address(
                ip_address=ip_address,
                subnet=subnet,
                gateway=gateway,
                dns=dns,
                status="available",
                reserved=False,
            )
            session.add(ip)
            await session.commit()
            await session.refresh(ip)
            logger.info(f"Added IP {ip_address} to pool")
            return ip

    async def remove_ip(self, ip_id: int) -> None:
        async with async_session_maker() as session:
            result = await session.execute(
                select(IPv4Address).where(IPv4Address.id == ip_id)
            )
            ip = result.scalar_one_or_none()
            if not ip:
                raise IPNotFoundError(f"IP with id {ip_id} not found")

            if ip.status == "assigned":
                raise IPPoolError(
                    f"Cannot remove IP {ip.ip_address}: it is currently assigned. Release it first."
                )

            await session.delete(ip)
            await session.commit()
            logger.info(f"Removed IP {ip.ip_address} from pool")

    async def assign_ip(self, vps_id: int, user_id: int) -> IPv4Address:
        async with async_session_maker() as session:
            vps_result = await session.execute(
                select(VPS).where(VPS.id == vps_id)
            )
            vps = vps_result.scalar_one_or_none()
            if not vps:
                raise IPNotFoundError(f"VPS {vps_id} not found")

            if vps.ipv4_id:
                raise IPAllocationError(
                    f"VPS {vps_id} already has an IP assigned"
                )

            free_result = await session.execute(
                select(IPv4Address)
                .where(IPv4Address.status == "available")
                .where(IPv4Address.reserved == False)
                .order_by(IPv4Address.id)
                .limit(1)
            )
            ip = free_result.scalar_one_or_none()
            if not ip:
                raise IPAllocationError("No free IPs available in the pool")

            ip.status = "assigned"
            ip.vps_id = vps_id
            ip.user_id = user_id

            vps.ipv4_id = ip.id

            await session.commit()
            await session.refresh(ip)
            logger.info(f"Assigned IP {ip.ip_address} to VPS {vps_id}")
            return ip

    async def release_ip(self, ip_id: int) -> IPv4Address:
        async with async_session_maker() as session:
            result = await session.execute(
                select(IPv4Address).where(IPv4Address.id == ip_id)
            )
            ip = result.scalar_one_or_none()
            if not ip:
                raise IPNotFoundError(f"IP with id {ip_id} not found")

            if ip.status != "assigned":
                raise IPReleaseError(
                    f"Cannot release IP {ip.ip_address}: status is '{ip.status}'"
                )

            if ip.vps_id:
                vps_result = await session.execute(
                    select(VPS).where(VPS.id == ip.vps_id)
                )
                vps = vps_result.scalar_one_or_none()
                if vps:
                    vps.ipv4_id = None

            ip.status = "available"
            ip.vps_id = None
            ip.user_id = None
            ip.released_at = datetime.now(timezone.utc)

            await session.commit()
            await session.refresh(ip)
            logger.info(f"Released IP {ip.ip_address}")
            return ip

    async def reserve_ip(self, ip_id: int) -> IPv4Address:
        async with async_session_maker() as session:
            result = await session.execute(
                select(IPv4Address).where(IPv4Address.id == ip_id)
            )
            ip = result.scalar_one_or_none()
            if not ip:
                raise IPNotFoundError(f"IP with id {ip_id} not found")

            if ip.status == "assigned":
                raise IPPoolError(
                    f"Cannot reserve IP {ip.ip_address}: it is currently assigned. Release it first."
                )

            ip.reserved = True
            await session.commit()
            await session.refresh(ip)
            logger.info(f"Reserved IP {ip.ip_address}")
            return ip

    async def unreserve_ip(self, ip_id: int) -> IPv4Address:
        async with async_session_maker() as session:
            result = await session.execute(
                select(IPv4Address).where(IPv4Address.id == ip_id)
            )
            ip = result.scalar_one_or_none()
            if not ip:
                raise IPNotFoundError(f"IP with id {ip_id} not found")

            if not ip.reserved:
                raise IPPoolError(
                    f"Cannot unreserve IP {ip.ip_address}: not reserved"
                )

            ip.reserved = False
            await session.commit()
            await session.refresh(ip)
            logger.info(f"Unreserved IP {ip.ip_address}")
            return ip

    async def list_ips(
        self,
        status: Optional[str] = None,
        user_id: Optional[int] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> dict:
        async with async_session_maker() as session:
            query = select(IPv4Address)

            if status:
                query = query.where(IPv4Address.status == status)
            if user_id:
                query = query.where(IPv4Address.user_id == user_id)

            count_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(count_query)
            total = total_result.scalar()

            query = query.order_by(IPv4Address.ip_address)
            query = query.offset((page - 1) * per_page).limit(per_page)

            result = await session.execute(query)
            ips = result.scalars().all()

            return {
                "ips": [
                    {
                        "id": ip.id,
                        "ip_address": ip.ip_address,
                        "subnet": ip.subnet,
                        "gateway": ip.gateway,
                        "dns": ip.dns,
                        "status": ip.status,
                        "reserved": ip.reserved,
                        "vps_id": ip.vps_id,
                        "user_id": ip.user_id,
                        "created_at": ip.created_at.isoformat() if ip.created_at else None,
                        "released_at": ip.released_at.isoformat() if ip.released_at else None,
                    }
                    for ip in ips
                ],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page,
            }

    async def get_ip_stats(self) -> dict:
        async with async_session_maker() as session:
            total = await session.execute(select(func.count(IPv4Address.id)))
            available = await session.execute(
                select(func.count(IPv4Address.id)).where(IPv4Address.status == "available")
            )
            assigned = await session.execute(
                select(func.count(IPv4Address.id)).where(IPv4Address.status == "assigned")
            )
            reserved = await session.execute(
                select(func.count(IPv4Address.id)).where(IPv4Address.reserved == True)
            )

            return {
                "total": total.scalar() or 0,
                "available": available.scalar() or 0,
                "assigned": assigned.scalar() or 0,
                "reserved": reserved.scalar() or 0,
            }


ip_pool_service = IPPoolService()
