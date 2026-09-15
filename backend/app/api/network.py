import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import TailscaleNode, TmateSession, SSHXSession, VPS, User
from app.schemas.schemas import (
    MessageResponse,
    SSHXSessionResponse,
    TailscaleNodeResponse,
    TailscaleStatus,
    TmateSessionResponse,
)
from app.services.vps_service import exec_in_container

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/network", tags=["Network"])


async def _get_user_vps(vps_id: str, user: User, db: AsyncSession) -> VPS:
    result = await db.execute(select(VPS).where(VPS.vps_id == vps_id))
    vps = result.scalar_one_or_none()
    if not vps:
        raise HTTPException(status_code=404, detail="VPS not found")
    if not user.is_admin and vps.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return vps


# ── Tailscale ─────────────────────────────────────────────────

@router.get("/tailscale/{vps_id}", response_model=TailscaleNodeResponse)
async def get_tailscale_status(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    result = await db.execute(
        select(TailscaleNode).where(TailscaleNode.vps_id == vps.id)
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Tailscale not configured for this VPS")

    return node


@router.post("/tailscale/{vps_id}/up", response_model=MessageResponse)
async def tailscale_up(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id or vps.status != "running":
        raise HTTPException(status_code=400, detail="VPS is not running")

    if not settings.TAILSCALE_AUTH_KEY:
        raise HTTPException(status_code=500, detail="Tailscale auth key not configured")

    # Install tailscale
    exit_code, _ = await exec_in_container(
        vps.container_id,
        "curl -fsSL https://tailscale.com/install.sh | sh"
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail="Failed to install Tailscale")

    # Start tailscaled
    exit_code, _ = await exec_in_container(
        vps.container_id,
        "tailscaled --state=/var/lib/tailscale/tailscaled.state &"
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail="Failed to start tailscaled")

    # Authenticate
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"tailscale up --authkey={settings.TAILSCALE_AUTH_KEY}"
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Tailscale auth failed: {output}")

    # Get IP
    exit_code, ip_output = await exec_in_container(
        vps.container_id,
        "tailscale ip -4"
    )
    tailscale_ip = ip_output.strip() if exit_code == 0 else None

    # Update database
    result = await db.execute(
        select(TailscaleNode).where(TailscaleNode.vps_id == vps.id)
    )
    node = result.scalar_one_or_none()
    if node:
        node.ip = tailscale_ip
        node.status = "connected"
    else:
        node = TailscaleNode(
            vps_id=vps.id,
            ip=tailscale_ip,
            hostname=f"vps-{vps.vps_id[:8]}",
            status="connected",
            auth_key=settings.TAILSCALE_AUTH_KEY,
        )
        db.add(node)

    vps.tailscale_ip = tailscale_ip
    await db.flush()

    return MessageResponse(message=f"Tailscale connected. IP: {tailscale_ip}")


@router.post("/tailscale/{vps_id}/down", response_model=MessageResponse)
async def tailscale_down(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id or vps.status != "running":
        raise HTTPException(status_code=400, detail="VPS is not running")

    exit_code, _ = await exec_in_container(vps.container_id, "tailscale down")
    if exit_code != 0:
        raise HTTPException(status_code=500, detail="Failed to disconnect Tailscale")

    result = await db.execute(
        select(TailscaleNode).where(TailscaleNode.vps_id == vps.id)
    )
    node = result.scalar_one_or_none()
    if node:
        node.status = "disconnected"

    vps.tailscale_ip = None
    await db.flush()

    return MessageResponse(message="Tailscale disconnected")


@router.delete("/tailscale/{vps_id}", response_model=MessageResponse)
async def remove_tailscale(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)

    if vps.container_id and vps.status == "running":
        await exec_in_container(vps.container_id, "tailscale logout")

    result = await db.execute(
        select(TailscaleNode).where(TailscaleNode.vps_id == vps.id)
    )
    node = result.scalar_one_or_none()
    if node:
        await db.delete(node)

    vps.tailscale_ip = None
    await db.flush()

    return MessageResponse(message="Tailscale removed")


# ── tmate ─────────────────────────────────────────────────────

@router.get("/tmate/{vps_id}", response_model=TmateSessionResponse)
async def get_tmate_session(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    result = await db.execute(
        select(TmateSession).where(TmateSession.vps_id == vps.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="tmate session not found")
    return session


@router.post("/tmate/{vps_id}/refresh", response_model=TmateSessionResponse)
async def refresh_tmate_session(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.vps_service import get_tmate_session as fetch_tmate

    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id or vps.status != "running":
        raise HTTPException(status_code=400, detail="VPS is not running")

    session_str = await fetch_tmate(vps.container_id)
    if not session_str:
        raise HTTPException(status_code=500, detail="Failed to get tmate session")

    result = await db.execute(
        select(TmateSession).where(TmateSession.vps_id == vps.id)
    )
    session = result.scalar_one_or_none()
    if session:
        session.session_string = session_str
        session.status = "active"
        session.created_at = datetime.now(timezone.utc)
    else:
        session = TmateSession(
            vps_id=vps.id,
            user_id=current_user.id,
            session_string=session_str,
            status="active",
        )
        db.add(session)

    vps.tmate_session = session_str
    await db.flush()

    return session


@router.delete("/tmate/{vps_id}", response_model=MessageResponse)
async def remove_tmate(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)

    if vps.container_id and vps.status == "running":
        await exec_in_container(
            vps.container_id,
            "tmate -S /tmp/tmate.sock kill-server"
        )

    result = await db.execute(
        select(TmateSession).where(TmateSession.vps_id == vps.id)
    )
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)

    vps.tmate_session = None
    await db.flush()

    return MessageResponse(message="tmate session removed")


# ── SSHX ──────────────────────────────────────────────────────

@router.get("/sshx/{vps_id}", response_model=SSHXSessionResponse)
async def get_sshx_session(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    result = await db.execute(
        select(SSHXSession).where(SSHXSession.vps_id == vps.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="SSHX session not found")
    return session


@router.post("/sshx/{vps_id}/start", response_model=SSHXSessionResponse)
async def start_sshx_session(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    if not vps.container_id or vps.status != "running":
        raise HTTPException(status_code=400, detail="VPS is not running")

    # Install sshx
    exit_code, _ = await exec_in_container(
        vps.container_id,
        "curl -sSf https://sshx.io/get | sh"
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail="Failed to install sshx")

    # Start sshx in background
    exit_code, output = await exec_in_container(
        vps.container_id,
        "/root/.local/bin/sshx --no-analytics &"
    )

    # Wait and get the URL
    import time
    await asyncio.sleep(3)

    exit_code, url_output = await exec_in_container(
        vps.container_id,
        "cat /tmp/sshx_url.txt 2>/dev/null || echo ''"
    )

    session_url = url_output.strip() if exit_code == 0 and url_output.strip() else None

    if not session_url:
        # Try to get from process output
        exit_code, ps_output = await exec_in_container(
            vps.container_id,
            "ps aux | grep sshx"
        )

    result = await db.execute(
        select(SSHXSession).where(SSHXSession.vps_id == vps.id)
    )
    session = result.scalar_one_or_none()
    if session:
        session.session_url = session_url
        session.status = "active" if session_url else "error"
        session.created_at = datetime.now(timezone.utc)
    else:
        session = SSHXSession(
            vps_id=vps.id,
            user_id=current_user.id,
            session_url=session_url,
            status="active" if session_url else "error",
        )
        db.add(session)

    vps.sshx_session = session_url
    await db.flush()

    return session


@router.delete("/sshx/{vps_id}", response_model=MessageResponse)
async def remove_sshx(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)

    if vps.container_id and vps.status == "running":
        await exec_in_container(vps.container_id, "pkill -f sshx || true")

    result = await db.execute(
        select(SSHXSession).where(SSHXSession.vps_id == vps.id)
    )
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)

    vps.sshx_session = None
    await db.flush()

    return MessageResponse(message="SSHX session removed")
