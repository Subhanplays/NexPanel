import asyncio
import logging
import os
import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, hash_password
from app.models.models import VPS, User
from app.services.vps_service import exec_in_container, _get_docker_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vps", tags=["VPS Management"])


async def _get_user_vps(vps_id: str, user: User, db: AsyncSession) -> VPS:
    result = await db.execute(select(VPS).where(VPS.vps_id == vps_id))
    vps = result.scalar_one_or_none()
    if not vps:
        raise HTTPException(status_code=404, detail="VPS not found")
    if not user.is_admin and vps.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return vps


def _check_running(vps: VPS):
    if not vps.container_id or vps.status != "running":
        raise HTTPException(status_code=400, detail="VPS is not running")


# ── File Manager ──────────────────────────────────────────────

class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int
    modified: str
    permissions: str


class FileContent(BaseModel):
    path: str
    content: str
    size: int


class FileWrite(BaseModel):
    path: str
    content: str


@router.get("/{vps_id}/files", response_model=list[FileItem])
async def list_files(
    vps_id: str,
    path: str = "/",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    safe_path = path.replace("'", "'\\''")
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"ls -la '{safe_path}' 2>/dev/null | tail -n +2",
        timeout=10,
    )
    if exit_code != 0:
        raise HTTPException(status_code=400, detail=f"Cannot list path: {path}")

    items = []
    for line in output.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split(None, 8)
        if len(parts) < 9:
            continue
        perms = parts[0]
        size_str = parts[4]
        name = parts[8]
        is_dir = perms.startswith("d")
        try:
            size = int(size_str)
        except ValueError:
            size = 0
        full_path = os.path.join(path, name).replace("\\", "/")
        items.append(FileItem(
            name=name,
            path=full_path,
            is_dir=is_dir,
            size=size,
            modified="",
            permissions=perms,
        ))
    return items


@router.get("/{vps_id}/files/read", response_model=FileContent)
async def read_file(
    vps_id: str,
    path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    safe_path = path.replace("'", "'\\''")
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"cat '{safe_path}' 2>/dev/null || echo '__FILE_NOT_FOUND__'",
        timeout=10,
    )
    if "__FILE_NOT_FOUND__" in output:
        raise HTTPException(status_code=404, detail="File not found")

    exit_code, size_out = await exec_in_container(
        vps.container_id,
        f"stat -c%s '{safe_path}' 2>/dev/null || echo 0",
        timeout=5,
    )
    try:
        size = int(size_out.strip())
    except ValueError:
        size = len(output)

    return FileContent(path=path, content=output, size=size)


@router.post("/{vps_id}/files/write")
async def write_file(
    vps_id: str,
    body: FileWrite,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    safe_path = body.path.replace("'", "'\\''")
    content_b64 = base64.b64encode(body.content.encode("utf-8")).decode()
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"echo '{content_b64}' | base64 -d > '{safe_path}'",
        timeout=10,
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {output}")
    return {"message": "File saved"}


@router.delete("/{vps_id}/files")
async def delete_file(
    vps_id: str,
    path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    safe_path = path.replace("'", "'\\''")
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"rm -rf '{safe_path}'",
        timeout=10,
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {output}")
    return {"message": "Deleted"}


@router.post("/{vps_id}/files/mkdir")
async def make_dir(
    vps_id: str,
    body: FileWrite,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    safe_path = body.path.replace("'", "'\\''")
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"mkdir -p '{safe_path}'",
        timeout=10,
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to create directory: {output}")
    return {"message": "Directory created"}


@router.post("/{vps_id}/files/upload")
async def upload_file(
    vps_id: str,
    path: str = "/tmp",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    content = await file.read()
    b64 = base64.b64encode(content).decode()
    safe_path = path.replace("'", "'\\''")
    filename = file.filename.replace("'", "'\\''")
    dest = f"{safe_path}/{filename}"

    exit_code, output = await exec_in_container(
        vps.container_id,
        f"echo '{b64}' | base64 -d > '{dest}'",
        timeout=30,
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Upload failed: {output}")
    return {"message": f"Uploaded to {dest}"}


@router.get("/{vps_id}/files/download")
async def download_file(
    vps_id: str,
    path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import Response

    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    safe_path = path.replace("'", "'\\''")
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"base64 '{safe_path}' 2>/dev/null",
        timeout=30,
    )
    if exit_code != 0:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        content = base64.b64decode(output.replace("\n", ""))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decode file")

    filename = os.path.basename(path)
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{vps_id}/files/rename")
async def rename_file(
    vps_id: str,
    old_path: str,
    new_path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    safe_old = old_path.replace("'", "'\\''")
    safe_new = new_path.replace("'", "'\\''")
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"mv '{safe_old}' '{safe_new}'",
        timeout=10,
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Rename failed: {output}")
    return {"message": "Renamed"}


# ── Process Manager ───────────────────────────────────────────

class ProcessInfo(BaseModel):
    user: str
    pid: int
    cpu: float
    mem: float
    vsz: int
    rss: int
    command: str


@router.get("/{vps_id}/processes", response_model=list[ProcessInfo])
async def list_processes(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    exit_code, output = await exec_in_container(
        vps.container_id,
        "ps aux --sort=-%cpu | head -100",
        timeout=10,
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail="Failed to list processes")

    procs = []
    lines = output.strip().split("\n")
    for line in lines[1:]:
        parts = line.split(None, 10)
        if len(parts) < 11:
            continue
        try:
            procs.append(ProcessInfo(
                user=parts[0],
                pid=int(parts[1]),
                cpu=float(parts[2]),
                mem=float(parts[3]),
                vsz=int(parts[4]),
                rss=int(parts[5]),
                command=parts[10],
            ))
        except (ValueError, IndexError):
            continue
    return procs


@router.post("/{vps_id}/processes/{pid}/kill")
async def kill_process(
    vps_id: str,
    pid: int,
    signal: str = "SIGTERM",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    exit_code, output = await exec_in_container(
        vps.container_id,
        f"kill -{signal} {pid} 2>/dev/null || kill {pid}",
        timeout=5,
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to kill process: {output}")
    return {"message": f"Signal {signal} sent to PID {pid}"}


# ── Resource Monitor ──────────────────────────────────────────

class ResourceStats(BaseModel):
    cpu_percent: float
    memory_total: int
    memory_used: int
    memory_percent: float
    disk_total: int
    disk_used: int
    disk_percent: float
    network_rx: int
    network_tx: int
    uptime: str
    load_avg: str


@router.get("/{vps_id}/stats", response_model=ResourceStats)
async def get_stats(
    vps_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    client = _get_docker_client()
    try:
        container = client.containers.get(vps.container_id)
        stats = container.stats(stream=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {e}")

    cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                stats["precpu_stats"]["cpu_usage"]["total_usage"]
    system_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                   stats["precpu_stats"]["system_cpu_usage"]
    num_cpus = stats["cpu_stats"]["online_cpus"]
    cpu_percent = (cpu_delta / system_delta * num_cpus * 100.0) if system_delta > 0 else 0.0

    mem_stats = stats["memory_stats"]
    mem_total = mem_stats.get("limit", 0)
    mem_used = mem_stats.get("usage", 0)
    mem_percent = (mem_used / mem_total * 100.0) if mem_total > 0 else 0.0

    exit_code, disk_out = await exec_in_container(
        vps.container_id, "df -B1 / | tail -1", timeout=5
    )
    disk_parts = disk_out.split() if exit_code == 0 else ["", "0", "0", "0", "0", "/"]
    try:
        disk_total = int(disk_parts[1])
        disk_used = int(disk_parts[2])
    except (ValueError, IndexError):
        disk_total = 0
        disk_used = 0
    disk_percent = (disk_used / disk_total * 100.0) if disk_total > 0 else 0.0

    net_stats = stats.get("networks", {})
    net_rx = sum(v.get("rx_bytes", 0) for v in net_stats.values())
    net_tx = sum(v.get("tx_bytes", 0) for v in net_stats.values())

    exit_code, uptime_out = await exec_in_container(
        vps.container_id, "uptime -p 2>/dev/null || uptime", timeout=5
    )
    uptime_str = uptime_out if exit_code == 0 else "unknown"

    exit_code, load_out = await exec_in_container(
        vps.container_id, "cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}'", timeout=5
    )
    load_avg = load_out if exit_code == 0 else "0 0 0"

    return ResourceStats(
        cpu_percent=round(cpu_percent, 1),
        memory_total=mem_total,
        memory_used=mem_used,
        memory_percent=round(mem_percent, 1),
        disk_total=disk_total,
        disk_used=disk_used,
        disk_percent=round(disk_percent, 1),
        network_rx=net_rx,
        network_tx=net_tx,
        uptime=uptime_str,
        load_avg=load_avg,
    )


# ── Command Executor ──────────────────────────────────────────

class CommandRequest(BaseModel):
    command: str
    timeout: int = 30


class CommandResponse(BaseModel):
    exit_code: int
    output: str


@router.post("/{vps_id}/exec", response_model=CommandResponse)
async def exec_command(
    vps_id: str,
    body: CommandRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    timeout = min(body.timeout, 120)
    exit_code, output = await exec_in_container(
        vps.container_id, body.command, timeout=timeout
    )
    return CommandResponse(exit_code=exit_code, output=output[:50000])


# ── VPS Management ────────────────────────────────────────────

class PasswordChange(BaseModel):
    new_password: str


@router.post("/{vps_id}/change-password")
async def change_password(
    vps_id: str,
    body: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)
    _check_running(vps)

    safe_user = vps.username.replace("'", "'\\''")
    safe_pass = body.new_password.replace("'", "'\\''")
    exit_code, output = await exec_in_container(
        vps.container_id,
        f"echo '{safe_user}:{safe_pass}' | chpasswd",
        timeout=10,
    )
    if exit_code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to change password: {output}")

    vps.password_hash = hash_password(body.new_password)
    await db.flush()
    return {"message": "Password changed"}


class ReinstallRequest(BaseModel):
    os_image: str


@router.post("/{vps_id}/reinstall")
async def reinstall_os(
    vps_id: str,
    body: ReinstallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vps = await _get_user_vps(vps_id, current_user, db)

    from app.services.vps_service import reinstall_vps, generate_password
    new_password = generate_password()
    await reinstall_vps(db, vps, new_password)
    return {"message": "Reinstalling OS", "new_password": new_password}
