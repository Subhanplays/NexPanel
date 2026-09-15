import asyncio
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_maker
from app.models.models import VPS
from app.services.vps_service import exec_in_container

logger = logging.getLogger(__name__)


class TailscaleError(Exception):
    pass


class TailscaleNotAvailableError(TailscaleError):
    pass


class TailscaleService:
    async def setup_tailscale(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise TailscaleError(f"VPS {vps_id} not found")

        if not vps.container_id:
            raise TailscaleError(f"VPS {vps_id} has no container")

        auth_key = settings.TAILSCALE_AUTH_KEY
        if not auth_key:
            raise TailscaleError("TAILSCALE_AUTH_KEY is not configured")

        install_cmd = "curl -fsSL https://tailscale.com/install.sh | sh"
        exit_code, output = await exec_in_container(vps.container_id, install_cmd, timeout=120)
        if exit_code != 0:
            raise TailscaleError(f"Failed to install Tailscale: {output}")

        start_cmd = "nohup tailscaled --state=/var/lib/tailscale/tailscaled.state > /dev/null 2>&1 &"
        await exec_in_container(vps.container_id, start_cmd, timeout=10)
        await asyncio.sleep(3)

        up_cmd = f"tailscale up --authkey={auth_key} --accept-routes"
        exit_code, output = await exec_in_container(vps.container_id, up_cmd, timeout=settings.TAILSCALE_TIMEOUT)
        if exit_code != 0 and "already" not in output.lower():
            logger.warning(f"Tailscale up output: {output}")

        ip = await self.get_tailscale_ip(vps_id)

        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if vps:
                vps.tailscale_ip = ip
                await session.commit()

        return {
            "vps_id": vps_id,
            "status": "connected" if ip else "setup_complete",
            "tailscale_ip": ip,
        }

    async def get_tailscale_status(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise TailscaleError(f"VPS {vps_id} not found")

        if not vps.container_id:
            return {"vps_id": vps_id, "installed": False, "status": "no_container", "tailscale_ip": None}

        exit_code, stdout = await exec_in_container(
            vps.container_id, "tailscale status 2>/dev/null || echo NOT_INSTALLED", timeout=10
        )

        if "NOT_INSTALLED" in stdout or exit_code != 0:
            return {"vps_id": vps_id, "installed": False, "status": "not_installed", "tailscale_ip": None}

        ip = await self.get_tailscale_ip(vps_id)
        return {
            "vps_id": vps_id,
            "installed": True,
            "status": "connected" if ip else "disconnected",
            "tailscale_ip": ip,
            "raw_status": stdout.strip(),
        }

    async def get_tailscale_ip(self, vps_id: str) -> Optional[str]:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps or not vps.container_id:
                return None

        exit_code, stdout = await exec_in_container(
            vps.container_id, "tailscale ip -4", timeout=10
        )
        if exit_code == 0 and stdout.strip():
            return stdout.strip().split("\n")[0]
        return None

    async def remove_tailscale(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise TailscaleError(f"VPS {vps_id} not found")

        if not vps.container_id:
            return {"vps_id": vps_id, "status": "no_container"}

        commands = [
            "tailscale down || true",
            "rm -rf /var/lib/tailscale /var/run/tailscale",
            "killall tailscaled || true",
        ]
        for cmd in commands:
            try:
                await exec_in_container(vps.container_id, cmd, timeout=15)
            except Exception as e:
                logger.warning(f"Tailscale cleanup command failed: {cmd}: {e}")

        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if vps:
                vps.tailscale_ip = None
                await session.commit()

        return {"vps_id": vps_id, "status": "removed"}


tailscale_service = TailscaleService()
