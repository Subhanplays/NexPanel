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


class TmateError(Exception):
    pass


class TmateService:
    def __init__(self):
        self._session_cache: dict[str, dict] = {}

    async def start_tmate_session(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise TmateError(f"VPS {vps_id} not found")
            if not vps.container_id:
                raise TmateError(f"VPS {vps_id} has no container")

        container_id = vps.container_id

        exit_code, _ = await exec_in_container(
            container_id,
            "which tmate || (apt-get update && apt-get install -y tmate)",
            timeout=60,
        )
        if exit_code != 0:
            raise TmateError("Failed to install tmate")

        await exec_in_container(container_id, "pkill -f tmate || true", timeout=5)

        exit_code, _ = await exec_in_container(
            container_id,
            "tmate -S /tmp/tmate.sock new-session -d",
            timeout=10,
        )
        if exit_code != 0:
            raise TmateError("Failed to start tmate session")

        await asyncio.sleep(2)

        session_info = await self._extract_tmate_info(container_id)
        if not session_info:
            raise TmateError("Failed to capture tmate session info")

        self._session_cache[vps_id] = session_info

        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if vps:
                vps.tmate_session = session_info.get("ssh_command")
                await session.commit()

        return {
            "vps_id": vps_id,
            "status": "running",
            "ssh_command": session_info.get("ssh_command"),
            "web_url": session_info.get("web_url"),
            "session_id": session_info.get("session_id"),
        }

    async def get_tmate_status(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise TmateError(f"VPS {vps_id} not found")
            if not vps.container_id:
                return {"vps_id": vps_id, "status": "no_container", "installed": False}

        exit_code, stdout = await exec_in_container(
            vps.container_id,
            "pgrep -f tmate >/dev/null && echo running || echo stopped",
            timeout=5,
        )

        is_running = "running" in (stdout or "").strip().lower()

        if is_running:
            if vps_id in self._session_cache:
                session_info = self._session_cache[vps_id]
            else:
                session_info = await self._extract_tmate_info(vps.container_id)
                if session_info:
                    self._session_cache[vps_id] = session_info

            return {
                "vps_id": vps_id,
                "installed": True,
                "status": "running",
                "ssh_command": session_info.get("ssh_command") if session_info else vps.tmate_session,
                "web_url": session_info.get("web_url") if session_info else None,
                "session_id": session_info.get("session_id") if session_info else None,
            }

        if vps_id in self._session_cache:
            del self._session_cache[vps_id]

        return {
            "vps_id": vps_id,
            "installed": True,
            "status": "stopped",
            "ssh_command": None,
            "web_url": None,
            "session_id": None,
        }

    async def stop_tmate_session(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise TmateError(f"VPS {vps_id} not found")
            if not vps.container_id:
                return {"vps_id": vps_id, "status": "no_container"}

        await exec_in_container(vps.container_id, "pkill -f tmate || true", timeout=5)

        if vps_id in self._session_cache:
            del self._session_cache[vps_id]

        vps.tmate_session = None
        await session.commit()

        return {"vps_id": vps_id, "status": "stopped"}

    async def _extract_tmate_info(self, container_id: str) -> Optional[dict]:
        exit_code, stdout = await exec_in_container(
            container_id,
            "tmate -S /tmp/tmate.sock display -p '#{tmate-ssh-proto} #{tmate-ssh-connect}'",
            timeout=10,
        )
        ssh_command = (stdout or "").strip()
        if not ssh_command or "ssh" not in ssh_command.lower():
            return None

        exit_code2, stdout2 = await exec_in_container(
            container_id,
            "tmate -S /tmp/tmate.sock display -p '#{tmate-web-proto} #{tmate-web-connect}'",
            timeout=10,
        )
        web_url = (stdout2 or "").strip()
        if not web_url or "http" not in web_url.lower():
            web_url = None

        session_id = None
        session_match = re.search(r"@\S+", ssh_command)
        if session_match:
            session_id = session_match.group(0).lstrip("@").rstrip(":")

        return {
            "ssh_command": ssh_command,
            "web_url": web_url,
            "session_id": session_id or ssh_command,
        }


tmate_service = TmateService()
