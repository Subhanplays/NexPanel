import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.config import settings
from app.database import async_session_maker
from app.middleware.auth import decode_token
from app.models.models import TerminalSession, VPS, User
from app.services.vps_service import get_docker_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Terminal"])


@router.websocket("/ws/terminal/{vps_id}")
async def websocket_terminal(
    websocket: WebSocket,
    vps_id: str,
    token: str = None,
):
    await websocket.accept()

    # Authenticate
    if not token:
        try:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=10)
            msg = json.loads(data)
            token = msg.get("token")
        except (asyncio.TimeoutError, json.JSONDecodeError):
            await websocket.close(code=4001, reason="Auth timeout")
            return

    if not token:
        await websocket.close(code=4001, reason="No token")
        return

    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4003, reason="Invalid token")
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4003, reason="Invalid token payload")
        return

    # Verify VPS ownership
    async with async_session_maker() as db:
        result = await db.execute(
            select(VPS).where(VPS.vps_id == vps_id)
        )
        vps = result.scalar_one_or_none()
        if not vps:
            await websocket.close(code=4004, reason="VPS not found")
            return

        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user or (not user.is_admin and vps.user_id != user_id):
            await websocket.close(code=4003, reason="Not authorized")
            return

        if vps.status != "running":
            await websocket.close(code=4009, reason="VPS is not running")
            return

        if not vps.container_id:
            await websocket.close(code=4009, reason="No container")
            return

        # Create terminal session record
        term_session = TerminalSession(
            vps_id=vps.id,
            user_id=user_id,
        )
        db.add(term_session)
        await db.commit()
        session_id = term_session.session_id

    # Connect to container's shell
    client = get_docker_client()
    try:
        container = client.containers.get(vps.container_id)
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        await websocket.close(code=4010, reason="Container not found")
        return

    try:
        exec_instance = container.exec_run(
            cmd="/bin/bash",
            stdin=True,
            stdout=True,
            stderr=True,
            demux=True,
            socket=True,
            tty=True,
        )
        sock = exec_instance.output.socket

        # Send initial message
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "message": "Connected to terminal",
        })

        # Bridge WebSocket <-> Docker exec socket
        async def read_websocket():
            try:
                while True:
                    data = await websocket.receive_text()
                    msg = json.loads(data)
                    if msg.get("type") == "input":
                        sock.send(msg["data"].encode())
                    elif msg.get("type") == "resize":
                        # Terminal resize - would need to handle with winsize
                        pass
                    elif msg.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                pass
            except Exception as e:
                logger.error(f"WS read error: {e}")

        async def read_docker():
            try:
                while True:
                    loop = asyncio.get_event_loop()
                    data = await loop.run_in_executor(None, lambda: sock.recv(4096))
                    if not data:
                        break
                    output = data.decode(errors="replace")
                    await websocket.send_json({"type": "output", "data": output})
            except Exception as e:
                logger.error(f"Docker read error: {e}")

        # Run both directions concurrently
        read_task = asyncio.create_task(read_websocket())
        write_task = asyncio.create_task(read_docker())

        done, pending = await asyncio.wait(
            [read_task, write_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()

    except Exception as e:
        logger.error(f"Terminal session error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            sock.close()
        except Exception:
            pass

        # Update session record
        try:
            async with async_session_maker() as db:
                result = await db.execute(
                    select(TerminalSession).where(TerminalSession.session_id == session_id)
                )
                session = result.scalar_one_or_none()
                if session:
                    session.last_active = datetime.now(timezone.utc)
                    await db.commit()
        except Exception:
            pass

        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/ws/exec/{vps_id}")
async def websocket_exec(
    websocket: WebSocket,
    vps_id: str,
    token: str = None,
):
    await websocket.accept()

    if not token:
        try:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=10)
            msg = json.loads(data)
            token = msg.get("token")
        except (asyncio.TimeoutError, json.JSONDecodeError):
            await websocket.close(code=4001, reason="Auth timeout")
            return

    if not token:
        await websocket.close(code=4001, reason="No token")
        return

    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4003, reason="Invalid token")
        return

    user_id = payload.get("sub")

    async with async_session_maker() as db:
        result = await db.execute(select(VPS).where(VPS.vps_id == vps_id))
        vps = result.scalar_one_or_none()
        if not vps:
            await websocket.close(code=4004, reason="VPS not found")
            return

        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user or (not user.is_admin and vps.user_id != user_id):
            await websocket.close(code=4003, reason="Not authorized")
            return

        if not vps.container_id:
            await websocket.close(code=4009, reason="No container")
            return

    client = get_docker_client()
    try:
        container = client.containers.get(vps.container_id)
    except Exception:
        await websocket.close(code=4010, reason="Container not found")
        return

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "exec":
                command = msg.get("command", "")
                if not command:
                    await websocket.send_json({
                        "type": "error",
                        "message": "No command provided",
                    })
                    continue

                result = container.exec_run(
                    cmd=["bash", "-c", command],
                    demux=True,
                )

                stdout = result.output[0].decode() if result.output[0] else ""
                stderr = result.output[1].decode() if result.output[1] else ""

                await websocket.send_json({
                    "type": "result",
                    "exit_code": result.exit_code,
                    "stdout": stdout,
                    "stderr": stderr,
                })

            elif msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Exec WS error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/ws/deploy")
async def websocket_deploy(
    websocket: WebSocket,
    token: str = None,
):
    await websocket.accept()

    if not token:
        try:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=10)
            msg = json.loads(data)
            token = msg.get("token")
        except (asyncio.TimeoutError, json.JSONDecodeError):
            await websocket.close(code=4001, reason="Auth timeout")
            return

    if not token:
        await websocket.close(code=4001, reason="No token")
        return

    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4003, reason="Invalid token")
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4003, reason="Invalid token payload")
        return

    await websocket.send_json({
        "type": "connected",
        "message": "Deploy WebSocket connected",
    })

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg.get("type") == "subscribe":
                vps_id = msg.get("vps_id")
                if vps_id:
                    await websocket.send_json({
                        "type": "subscribed",
                        "vps_id": vps_id,
                    })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Deploy WS error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.websocket("/ws/vps/{vps_id}/usage")
async def websocket_vps_usage(
    websocket: WebSocket,
    vps_id: str,
    token: str = None,
):
    await websocket.accept()

    if not token:
        try:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=10)
            msg = json.loads(data)
            token = msg.get("token")
        except (asyncio.TimeoutError, json.JSONDecodeError):
            await websocket.close(code=4001, reason="Auth timeout")
            return

    if not token:
        await websocket.close(code=4001, reason="No token")
        return

    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4003, reason="Invalid token")
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4003, reason="Invalid token payload")
        return

    async with async_session_maker() as db:
        result = await db.execute(select(VPS).where(VPS.vps_id == vps_id))
        vps = result.scalar_one_or_none()
        if not vps:
            await websocket.close(code=4004, reason="VPS not found")
            return

        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user or (not user.is_admin and vps.user_id != user_id):
            await websocket.close(code=4003, reason="Not authorized")
            return

        if not vps.container_id:
            await websocket.close(code=4009, reason="No container")
            return

        container_id = vps.container_id

    from app.services.vps_service import get_container_metrics, get_disk_usage

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=1)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
            except (asyncio.TimeoutError, json.JSONDecodeError):
                pass

            try:
                metrics = await get_container_metrics(container_id)
                if metrics:
                    disk = await get_disk_usage(container_id)
                    await websocket.send_json({
                        "type": "metrics",
                        "cpu": metrics.get("cpu_percent", 0),
                        "ram": metrics.get("memory_percent", 0),
                        "disk": disk.get("percent", 0),
                        "network_rx": metrics.get("network_rx_bytes", 0),
                        "network_tx": metrics.get("network_tx_bytes", 0),
                        "pids": metrics.get("pids", 0),
                    })
            except Exception as e:
                logger.error(f"Metrics error for {vps_id}: {e}")

            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"VPS usage WS error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
