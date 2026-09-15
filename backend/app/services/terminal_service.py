import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select

from app.database import async_session_maker
from app.models.models import VPS
from app.services.vps_service import exec_in_container

logger = logging.getLogger(__name__)


class TerminalError(Exception):
    pass


class TerminalSessionNotFoundError(TerminalError):
    pass


@dataclass
class TerminalSession:
    session_id: str
    vps_id: str
    user_id: int
    container_id: str
    cols: int = 80
    rows: int = 24
    process: Optional[asyncio.subprocess.Process] = field(default=None, repr=False)
    is_active: bool = True


class TerminalService:
    def __init__(self):
        self._sessions: dict[str, TerminalSession] = {}

    async def create_terminal(
        self,
        vps_id: str,
        user_id: int,
        cols: int = 80,
        rows: int = 24,
    ) -> TerminalSession:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                raise TerminalError(f"VPS {vps_id} not found")
            if not vps.container_id:
                raise TerminalError(f"VPS {vps_id} has no container")

        session_id = str(uuid.uuid4())

        process = await asyncio.create_subprocess_exec(
            "docker", "exec", "-it",
            "-e", f"COLUMNS={cols}",
            "-e", f"LINES={rows}",
            vps.container_id,
            "bash",
            "--login",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.PIPE,
        )

        terminal = TerminalSession(
            session_id=session_id,
            vps_id=vps_id,
            user_id=user_id,
            container_id=vps.container_id,
            cols=cols,
            rows=rows,
            process=process,
            is_active=True,
        )

        self._sessions[session_id] = terminal
        logger.info(f"Created terminal session {session_id} for VPS {vps_id}")
        return terminal

    async def handle_terminal_input(self, session_id: str, data: str) -> None:
        session = self._get_session(session_id)
        if not session.process or not session.is_active:
            raise TerminalError(f"Terminal session {session_id} is not active")

        try:
            session.process.stdin.write(data.encode("utf-8"))
            await session.process.stdin.drain()
        except (BrokenPipeError, ConnectionResetError, AttributeError):
            session.is_active = False
            raise TerminalError(f"Terminal session {session_id} pipe broken")
        except Exception as e:
            session.is_active = False
            raise TerminalError(f"Failed to write to terminal: {e}")

    async def handle_terminal_output_queue(
        self, session_id: str, queue: asyncio.Queue
    ) -> None:
        session = self._get_session(session_id)
        if not session.process or not session.is_active:
            raise TerminalError(f"Terminal session {session_id} is not active")

        try:
            while session.is_active and session.process and session.process.returncode is None:
                try:
                    data = await asyncio.wait_for(
                        session.process.stdout.read(4096),
                        timeout=30,
                    )
                    if not data:
                        break
                    text = data.decode("utf-8", errors="replace")
                    await queue.put({"type": "output", "data": text})
                except asyncio.TimeoutError:
                    continue
        except Exception as e:
            logger.error(f"Terminal output error for session {session_id}: {e}")
        finally:
            session.is_active = False
            await queue.put({"type": "closed"})

    async def resize_terminal(self, session_id: str, cols: int, rows: int) -> None:
        session = self._get_session(session_id)
        session.cols = cols
        session.rows = rows

        try:
            await exec_in_container(
                session.container_id,
                f"stty rows {rows} cols {cols}",
                timeout=5,
            )
        except Exception:
            pass

    async def close_terminal(self, session_id: str) -> None:
        session = self._sessions.pop(session_id, None)
        if not session:
            return

        session.is_active = False

        if session.process:
            try:
                session.process.stdin.close()
            except Exception:
                pass
            try:
                session.process.terminate()
                await asyncio.wait_for(session.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                try:
                    session.process.kill()
                    await session.process.wait()
                except Exception:
                    pass
            except Exception:
                pass

        logger.info(f"Closed terminal session {session_id}")

    def get_session(self, session_id: str) -> Optional[TerminalSession]:
        return self._sessions.get(session_id)

    def list_sessions_for_user(self, user_id: int) -> list[dict]:
        return [
            {
                "session_id": sid,
                "vps_id": s.vps_id,
                "cols": s.cols,
                "rows": s.rows,
            }
            for sid, s in self._sessions.items()
            if s.user_id == user_id and s.is_active
        ]

    def _get_session(self, session_id: str) -> TerminalSession:
        session = self._sessions.get(session_id)
        if not session:
            raise TerminalSessionNotFoundError(f"Terminal session {session_id} not found")
        return session


terminal_service = TerminalService()
