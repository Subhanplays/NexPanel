import asyncio
import logging
import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_maker
from app.models.models import VPS
from app.services.vps_service import exec_in_container

logger = logging.getLogger(__name__)


class SSHXError(Exception):
    pass


class SSHXService:
    async def start_sshx_session(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise SSHXError(f"VPS {vps_id} not found")
            if not vps.container_id:
                raise SSHXError(f"VPS {vps_id} has no container")

        container_id = vps.container_id

        exit_code, _ = await exec_in_container(
            container_id,
            "which sshx || (curl -sSf https://sshx.io/get | sh)",
            timeout=60,
        )
        if exit_code != 0:
            raise SSHXError("Failed to install sshx")

        await exec_in_container(container_id, "pkill -f sshx || true", timeout=5)

        server_flag = f"-s {settings.SSHX_SERVER}" if settings.SSHX_SERVER else ""
        await exec_in_container(
            container_id,
            f"nohup /root/.local/bin/sshx {server_flag} --term=xterm-256color > /tmp/sshx_output.log 2>&1 &",
            timeout=10,
        )

        await asyncio.sleep(3)

        session_info = await self._extract_sshx_link(container_id)

        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if vps:
                vps.sshx_session = session_info.get("url") if session_info else None
                await session.commit()

        return {
            "vps_id": vps_id,
            "status": "running",
            "session_url": session_info.get("url") if session_info else None,
            "session_id": session_info.get("session_id") if session_info else None,
        }

    async def get_sshx_status(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise SSHXError(f"VPS {vps_id} not found")
            if not vps.container_id:
                return {"vps_id": vps_id, "status": "no_container", "installed": False}

        exit_code, stdout = await exec_in_container(
            vps.container_id,
            "pgrep -f sshx >/dev/null && echo running || echo stopped",
            timeout=5,
        )

        is_running = "running" in (stdout or "").strip().lower()

        if is_running:
            session_info = await self._extract_sshx_link(vps.container_id)
            return {
                "vps_id": vps_id,
                "installed": True,
                "status": "running",
                "session_url": session_info.get("url") if session_info else vps.sshx_session,
                "session_id": session_info.get("session_id") if session_info else None,
            }

        return {
            "vps_id": vps_id,
            "installed": True,
            "status": "stopped",
            "session_url": None,
            "session_id": None,
        }

    async def stop_sshx_session(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise SSHXError(f"VPS {vps_id} not found")
            if not vps.container_id:
                return {"vps_id": vps_id, "status": "no_container"}

        await exec_in_container(vps.container_id, "pkill -f sshx || true", timeout=5)

        vps.sshx_session = None
        await session.commit()

        return {"vps_id": vps_id, "status": "stopped"}

    async def _extract_sshx_link(self, container_id: str) -> Optional[dict]:
        exit_code, stdout = await exec_in_container(
            container_id, "cat /tmp/sshx_output.log 2>/dev/null || echo ''", timeout=5
        )
        output = stdout or ""
        url_match = re.search(r"(https://sshx\.io/[a-zA-Z0-9]+)", output)
        if url_match:
            url = url_match.group(1)
            session_id = url.split("/")[-1]
            return {"url": url, "session_id": session_id}
        return None


sshx_service = SSHXService()
