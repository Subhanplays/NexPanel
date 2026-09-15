import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select

from app.config import settings
from app.database import async_session_maker
from app.models.models import BrandingSetting

logger = logging.getLogger(__name__)

DEFAULT_BRANDING = {
    "brand_name": settings.BRAND_NAME,
    "brand_logo_url": settings.BRAND_LOGO_URL or "",
    "brand_color": settings.BRAND_COLOR,
    "brand_favicon_url": "",
    "brand_footer": settings.BRAND_FOOTER,
    "brand_login_bg_url": "",
    "brand_primary_color": settings.BRAND_COLOR,
    "brand_secondary_color": "#1e40af",
    "brand_accent_color": "#10b981",
    "brand_login_title": f"Welcome to {settings.BRAND_NAME}",
    "brand_login_subtitle": "Sign in to manage your VPS instances",
    "brand_registration_enabled": "true",
    "brand_terms_url": "",
    "brand_privacy_url": "",
    "brand_support_email": "",
    "brand_maintenance_mode": "false",
    "brand_maintenance_message": "System is under maintenance. Please try again later.",
}


class BrandingError(Exception):
    pass


class BrandingService:
    async def get_branding(self) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(select(BrandingSetting))
            settings_list = result.scalars().all()

        branding = dict(DEFAULT_BRANDING)
        for setting in settings_list:
            branding[setting.key] = setting.value
        return branding

    async def update_branding(self, key: str, value: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(BrandingSetting).where(BrandingSetting.key == key)
            )
            setting = result.scalar_one_or_none()

            if setting:
                setting.value = value
                setting.updated_at = datetime.now(timezone.utc)
            else:
                setting = BrandingSetting(key=key, value=value)
                session.add(setting)

            await session.commit()
            await session.refresh(setting)
            logger.info(f"Updated branding setting: {key} = {value}")

        return {"key": key, "value": value}

    async def update_branding_bulk(self, settings_dict: dict[str, str]) -> dict:
        updated = {}
        async with async_session_maker() as session:
            for key, value in settings_dict.items():
                result = await session.execute(
                    select(BrandingSetting).where(BrandingSetting.key == key)
                )
                setting = result.scalar_one_or_none()
                if setting:
                    setting.value = value
                    setting.updated_at = datetime.now(timezone.utc)
                else:
                    setting = BrandingSetting(key=key, value=value)
                    session.add(setting)
                updated[key] = value
            await session.commit()
        return updated

    async def delete_branding(self, key: str) -> bool:
        async with async_session_maker() as session:
            result = await session.execute(
                select(BrandingSetting).where(BrandingSetting.key == key)
            )
            setting = result.scalar_one_or_none()
            if not setting:
                return False
            await session.delete(setting)
            await session.commit()
            logger.info(f"Deleted branding setting: {key}")
            return True

    async def get_branding_value(self, key: str) -> Optional[str]:
        async with async_session_maker() as session:
            result = await session.execute(
                select(BrandingSetting).where(BrandingSetting.key == key)
            )
            setting = result.scalar_one_or_none()
            if setting:
                return setting.value
            return DEFAULT_BRANDING.get(key)

    def get_default_branding(self) -> dict:
        return dict(DEFAULT_BRANDING)

    async def init_default_branding(self) -> None:
        async with async_session_maker() as session:
            result = await session.execute(select(BrandingSetting))
            existing = {s.key for s in result.scalars().all()}
            for key, value in DEFAULT_BRANDING.items():
                if key not in existing:
                    session.add(BrandingSetting(key=key, value=value))
            await session.commit()
            logger.info("Initialized default branding settings")

    async def get_brand_css(self) -> str:
        branding = await self.get_branding()
        primary = branding.get("brand_primary_color", branding.get("brand_color", "#3b82f6"))
        secondary = branding.get("brand_secondary_color", "#1e40af")
        accent = branding.get("brand_accent_color", "#10b981")
        return f"""
:root {{
    --brand-primary: {primary};
    --brand-secondary: {secondary};
    --brand-accent: {accent};
    --brand-name: "{branding.get('brand_name', 'NexPanel')}";
}}
body {{ --primary: {primary}; }}
.btn-primary {{ background-color: {primary}; border-color: {primary}; }}
.btn-primary:hover {{ background-color: {secondary}; border-color: {secondary}; }}
a {{ color: {primary}; }}
a:hover {{ color: {secondary}; }}
"""


branding_service = BrandingService()
