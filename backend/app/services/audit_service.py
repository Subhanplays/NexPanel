import logging
from typing import Optional

from sqlalchemy import func, select

from app.config import settings
from app.database import async_session_maker
from app.models.models import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    def __init__(self):
        self.enabled = settings.AUDIT_LOG_ENABLED

    async def log_action(
        self,
        user_id: Optional[int],
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[AuditLog]:
        if not self.enabled:
            return None

        try:
            async with async_session_maker() as session:
                entry = AuditLog(
                    user_id=user_id,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    details=details,
                    ip_address=ip_address,
                )
                session.add(entry)
                await session.commit()
                await session.refresh(entry)
                logger.info(
                    f"Audit: user={user_id} action={action} "
                    f"resource={resource_type}/{resource_id} ip={ip_address}"
                )
                return entry
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
            return None

    async def log_vps_action(
        self,
        user_id: Optional[int],
        action: str,
        vps_id: str,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[AuditLog]:
        return await self.log_action(
            user_id=user_id,
            action=action,
            resource_type="vps",
            resource_id=vps_id,
            details=details,
            ip_address=ip_address,
        )

    async def log_auth_action(
        self,
        user_id: Optional[int],
        action: str,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[AuditLog]:
        return await self.log_action(
            user_id=user_id,
            action=action,
            resource_type="auth",
            resource_id=None,
            details=details,
            ip_address=ip_address,
        )

    async def log_ip_action(
        self,
        user_id: Optional[int],
        action: str,
        ip_address_str: str,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[AuditLog]:
        return await self.log_action(
            user_id=user_id,
            action=action,
            resource_type="ip_pool",
            resource_id=ip_address_str,
            details=details,
            ip_address=ip_address,
        )

    async def log_system_action(
        self,
        action: str,
        details: Optional[dict] = None,
    ) -> Optional[AuditLog]:
        return await self.log_action(
            user_id=None,
            action=action,
            resource_type="system",
            resource_id=None,
            details=details,
            ip_address=None,
        )

    async def get_user_audit_logs(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        async with async_session_maker() as session:
            result = await session.execute(
                select(AuditLog)
                .where(AuditLog.user_id == user_id)
                .order_by(AuditLog.created_at.desc())
                .offset(offset)
                .limit(limit)
            )
            logs = result.scalars().all()

        return [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]

    async def get_audit_logs(
        self,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict:
        async with async_session_maker() as session:
            query = select(AuditLog)
            if action:
                query = query.where(AuditLog.action == action)
            if resource_type:
                query = query.where(AuditLog.resource_type == resource_type)

            count_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(count_query)
            total = total_result.scalar()

            query = query.order_by(AuditLog.created_at.desc())
            query = query.offset(offset).limit(limit)

            result = await session.execute(query)
            logs = result.scalars().all()

        return {
            "logs": [
                {
                    "id": log.id,
                    "user_id": log.user_id,
                    "action": log.action,
                    "resource_type": log.resource_type,
                    "resource_id": log.resource_id,
                    "details": log.details,
                    "ip_address": log.ip_address,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }


audit_service = AuditService()
