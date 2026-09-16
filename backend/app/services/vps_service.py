import asyncio
import logging
import random
import secrets
import shutil
import string
import tempfile
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import docker
from docker.errors import APIError, ImageNotFound, NotFound
from docker.types import LogConfig
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session_maker
from app.models.models import IPv4Address, VPS

logger = logging.getLogger(__name__)

DOCKER_NETWORK = settings.DOCKER_NETWORK

BASE_PACKAGES = [
    "systemd",
    "systemd-sysv",
    "dbus",
    "sudo",
    "curl",
    "gnupg2",
    "apt-transport-https",
    "ca-certificates",
    "software-properties-common",
    "docker.io",
    "openssh-server",
    "tmate",
    "neofetch",
    "htop",
    "nano",
    "vim",
    "wget",
    "git",
    "tmux",
    "net-tools",
    "dnsutils",
    "iputils-ping",
]

DOCKERFILE_TEMPLATE = """FROM {base_image}

ENV DEBIAN_FRONTEND=noninteractive
ENV container=docker

RUN apt-get update && apt-get install -y \\
    systemd systemd-sysv dbus sudo \\
    curl gnupg2 apt-transport-https ca-certificates \\
    software-properties-common \\
    docker.io openssh-server tmate \\
    {packages} && \\
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/run/sshd && \\
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \\
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \\
    echo "PermitRootLogin yes" >> /etc/ssh/sshd_config && \\
    echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config

RUN systemctl enable ssh && \\
    systemctl enable docker

RUN echo "root:{root_password}" | chpasswd && \\
    echo "{username}:{user_password}" | chpasswd

STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
"""


def _get_docker_client() -> docker.DockerClient:
    return docker.from_env()


def _ensure_network():
    client = _get_docker_client()
    try:
        client.networks.get(DOCKER_NETWORK)
    except NotFound:
        ipam_pool = docker.types.IPAMPool(subnet=settings.DOCKER_SUBNET)
        ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])
        client.networks.create(
            DOCKER_NETWORK,
            driver="bridge",
            ipam=ipam_config,
            check_duplicate=True,
        )
        logger.info(f"Created Docker network: {DOCKER_NETWORK}")


def generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _build_image(
    username: str,
    root_password: str,
    user_password: str,
    base_image: str,
    tag: str,
) -> docker.models.images.Image:
    packages_str = " \\\n    ".join(BASE_PACKAGES)
    dockerfile_content = DOCKERFILE_TEMPLATE.format(
        base_image=base_image,
        packages=packages_str,
        root_password=root_password,
        username=username,
        user_password=user_password,
    )

    tmp_dir = tempfile.mkdtemp()
    dockerfile_path = f"{tmp_dir}/Dockerfile"

    try:
        with open(dockerfile_path, "w") as f:
            f.write(dockerfile_content)

        client = _get_docker_client()
        image, build_logs = client.images.build(
            path=tmp_dir,
            tag=tag,
            rm=True,
            forcerm=True,
            timeout=settings.DOCKER_IMAGE_BUILD_TIMEOUT,
            network_mode="host",
        )
        for chunk in build_logs:
            if "stream" in chunk:
                logger.debug(chunk["stream"].strip())
        return image
    except Exception as e:
        raise RuntimeError(f"Image build failed: {e}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _wait_for_container_ready(container_id: str, max_wait: int = 60) -> bool:
    client = _get_docker_client()
    for _ in range(max_wait):
        try:
            container = client.containers.get(container_id)
            if container.status == "running":
                exit_code, _ = container.exec_run(
                    ["bash", "-c", "echo ready"],
                    demux=True,
                    timeout=5,
                )
                if exit_code == 0:
                    return True
        except Exception:
            pass
        await asyncio.sleep(1)
    logger.warning(f"Container {container_id} may not be fully ready after {max_wait}s")
    return False


async def provision_vps(
    db: AsyncSession,
    vps: VPS,
    password: str,
    assign_ipv4: bool = True,
    enable_tailscale: bool = False,
    enable_tmate: bool = True,
    enable_sshx: bool = False,
) -> None:
    client = _get_docker_client()
    _ensure_network()

    vps_id = vps.vps_id
    username = vps.username
    root_password = generate_password()
    user_password = password
    image_tag = f"nexpanel/{vps_id}:latest"

    try:
        _build_image(
            username=username,
            root_password=root_password,
            user_password=user_password,
            base_image=vps.os_image,
            tag=image_tag,
        )
        logger.info(f"Built image {image_tag} for VPS {vps_id}")
    except Exception as e:
        vps.status = "error"
        await db.commit()
        logger.error(f"Failed to build image for VPS {vps_id}: {e}")
        return

    mem_limit = f"{vps.memory_gb}g"
    cpu_quota = int(vps.cpu_cores * 100000)
    log_config = LogConfig(type=LogConfig.types.JSON, config={"max-size": "10m", "max-file": "3"})

    ssh_port = random.randint(20000, 30000)

    try:
        container = client.containers.run(
            image=image_tag,
            name=f"vps-{vps_id}",
            detach=True,
            privileged=True,
            cap_add=["SYS_ADMIN", "NET_ADMIN"],
            security_opt=["seccomp=unconfined"],
            hostname=f"vps-{vps_id}",
            mem_limit=mem_limit,
            cpu_period=100000,
            cpu_quota=cpu_quota,
            network=DOCKER_NETWORK,
            volumes={f"nexpanel-{vps_id}": {"bind": "/data", "mode": "rw"}},
            restart_policy={"Name": "always"},
            log_config=log_config,
            ports={"22/tcp": ssh_port},
            labels={"nexpanel": "true", "vps-id": vps_id, "user-id": str(vps.user_id)},
        )
        vps.container_id = container.id
        logger.info(f"Created container {container.short_id} for VPS {vps_id}")
    except Exception as e:
        vps.status = "error"
        await db.commit()
        logger.error(f"Failed to create container for VPS {vps_id}: {e}")
        return

    time.sleep(5)

    setup_cmds = [
        f"echo 'root:{root_password}' | chpasswd",
        f"echo 'echo Welcome to NexPanel VPS {vps_id}' > /etc/motd",
        f"echo '{vps_id}' > /etc/hostname && hostname {vps_id}",
        "ssh-keygen -A || true",
        "systemctl restart ssh || true",
        "mkdir -p /root/.ssh && chmod 700 /root/.ssh",
        "echo 'nameserver 8.8.8.8' > /etc/resolv.conf",
        "echo 'nameserver 8.8.4.4' >> /etc/resolv.conf",
        "apt-get update && apt-get upgrade -y || true",
        "apt-get -y autoremove || true",
        "apt-get clean || true",
    ]

    for cmd in setup_cmds:
        try:
            client.containers.get(vps.container_id).exec_run(
                ["bash", "-c", cmd], timeout=60
            )
        except Exception as e:
            logger.warning(f"Setup command failed: {cmd}: {e}")

    try:
        result = client.containers.get(vps.container_id).exec_run(
            ["bash", "-c", "cat /etc/ssh/ssh_host_rsa_key.pub"],
            demux=True,
            timeout=10,
        )
        if result.exit_code == 0 and result.output[0]:
            vps.tmate_session = result.output[0].decode("utf-8", errors="replace").strip()
    except Exception:
        pass

    if assign_ipv4:
        try:
            ip_result = await db.execute(
                select(IPv4Address)
                .where(IPv4Address.status == "available")
                .where(IPv4Address.reserved == False)
                .order_by(IPv4Address.id)
                .limit(1)
            )
            ipv4 = ip_result.scalar_one_or_none()
            if ipv4:
                ipv4.status = "assigned"
                ipv4.vps_id = vps.id
                ipv4.user_id = vps.user_id
                vps.ipv4_id = ipv4.id
        except Exception as e:
            logger.warning(f"Failed to assign IPv4: {e}")

    vps.status = "running"
    vps.root_password_hash = root_password
    vps.ssh_port = ssh_port
    await db.commit()
    logger.info(f"VPS {vps_id} provisioned successfully")

    if enable_tmate:
        try:
            session_str = await get_tmate_session(vps.container_id)
            if session_str:
                vps.tmate_session = session_str
                await db.commit()
                logger.info(f"tmate session started for VPS {vps_id}")
        except Exception as e:
            logger.warning(f"Failed to start tmate for VPS {vps_id}: {e}")

    if enable_tailscale:
        try:
            if settings.TAILSCALE_AUTH_KEY:
                await exec_in_container(
                    vps.container_id,
                    "curl -fsSL https://tailscale.com/install.sh | sh",
                    timeout=120,
                )
                await exec_in_container(
                    vps.container_id,
                    "nohup tailscaled --state=/var/lib/tailscale/tailscaled.state > /dev/null 2>&1 &",
                    timeout=10,
                )
                import asyncio as _aio
                await _aio.sleep(3)
                exit_code, output = await exec_in_container(
                    vps.container_id,
                    f"tailscale up --authkey={settings.TAILSCALE_AUTH_KEY} --accept-routes",
                    timeout=60,
                )
                if exit_code == 0 or "already" in output.lower():
                    exit_code, ip_out = await exec_in_container(
                        vps.container_id, "tailscale ip -4", timeout=10
                    )
                    if exit_code == 0 and ip_out.strip():
                        tailscale_ip = ip_out.strip().split("\n")[0]
                        vps.tailscale_ip = tailscale_ip
                        await db.commit()
                        logger.info(f"Tailscale connected for VPS {vps_id}, IP: {tailscale_ip}")

                        from app.models.models import TailscaleNode
                        existing = await db.execute(
                            select(TailscaleNode).where(TailscaleNode.vps_id == vps.id)
                        )
                        node = existing.scalar_one_or_none()
                        if not node:
                            db.add(TailscaleNode(
                                vps_id=vps.id,
                                ip=tailscale_ip,
                                hostname=f"vps-{vps_id[:8]}",
                                status="connected",
                                auth_key=settings.TAILSCALE_AUTH_KEY,
                            ))
                            await db.commit()
            else:
                logger.warning("TAILSCALE_AUTH_KEY not configured, skipping Tailscale setup")
        except Exception as e:
            logger.warning(f"Failed to setup Tailscale for VPS {vps_id}: {e}")

    if enable_sshx:
        try:
            await exec_in_container(
                vps.container_id,
                "curl -sSf https://sshx.io/get | sh",
                timeout=60,
            )
            exit_code, output = await exec_in_container(
                vps.container_id,
                "/root/.local/bin/sshx --no-analytics --url -o /dev/stdout",
                timeout=15,
            )
            if exit_code == 0 and output.strip():
                sshx_url = output.strip().split("\n")[-1]
                if "sshx.io" in sshx_url:
                    vps.sshx_session = sshx_url
                    await db.commit()
                    logger.info(f"SSHX session started for VPS {vps_id}: {sshx_url}")
        except Exception as e:
            logger.warning(f"Failed to start sshx for VPS {vps_id}: {e}")


async def delete_vps_container(container_id: str) -> None:
    client = _get_docker_client()
    try:
        container = client.containers.get(container_id)
        container.stop(timeout=10)
        container.remove(force=True)
        logger.info(f"Container {container_id} removed")
    except NotFound:
        logger.warning(f"Container {container_id} not found, may already be removed")
    except Exception as e:
        logger.error(f"Error removing container {container_id}: {e}")


async def start_vps(container_id: str) -> bool:
    client = _get_docker_client()
    try:
        container = client.containers.get(container_id)
        container.start()
        logger.info(f"Container {container_id} started")
        return True
    except NotFound:
        logger.error(f"Container {container_id} not found")
        return False
    except Exception as e:
        logger.error(f"Failed to start container {container_id}: {e}")
        return False


async def stop_vps(container_id: str) -> bool:
    client = _get_docker_client()
    try:
        container = client.containers.get(container_id)
        container.stop(timeout=30)
        logger.info(f"Container {container_id} stopped")
        return True
    except NotFound:
        logger.error(f"Container {container_id} not found")
        return False
    except Exception as e:
        logger.error(f"Failed to stop container {container_id}: {e}")
        return False


async def restart_vps(container_id: str) -> bool:
    client = _get_docker_client()
    try:
        container = client.containers.get(container_id)
        container.restart(timeout=30)
        logger.info(f"Container {container_id} restarted")
        return True
    except NotFound:
        logger.error(f"Container {container_id} not found")
        return False
    except Exception as e:
        logger.error(f"Failed to restart container {container_id}: {e}")
        return False


async def reinstall_vps(db: AsyncSession, vps: VPS, password: str) -> None:
    client = _get_docker_client()

    if vps.container_id:
        try:
            container = client.containers.get(vps.container_id)
            container.stop(timeout=30)
            container.remove(force=True)
        except (NotFound, Exception):
            pass

    username = vps.username
    root_password = generate_password()
    user_password = password
    image_tag = f"nexpanel/{vps.vps_id}:latest"

    try:
        _build_image(
            username=username,
            root_password=root_password,
            user_password=user_password,
            base_image=vps.os_image,
            tag=image_tag,
        )
    except Exception as e:
        vps.status = "error"
        await db.commit()
        logger.error(f"Failed to rebuild image for VPS {vps.vps_id}: {e}")
        return

    mem_limit = f"{vps.memory_gb}g"
    cpu_quota = int(vps.cpu_cores * 100000)
    data_dir = f"{settings.DOCKER_DATA_DIR}/{vps.vps_id}/data"
    log_config = LogConfig(type=LogConfig.types.JSON, config={"max-size": "10m", "max-file": "3"})

    try:
        container = client.containers.run(
            image=image_tag,
            name=f"vps-{vps.vps_id}",
            detach=True,
            privileged=True,
            cap_add=["ALL"],
            mem_limit=mem_limit,
            cpu_period=100000,
            cpu_quota=cpu_quota,
            network=DOCKER_NETWORK,
            volumes={data_dir: {"bind": "/data", "mode": "rw"}},
            restart_policy={"Name": "always"},
            log_config=log_config,
            hostname=f"vps-{vps.vps_id}",
            labels={"nexpanel": "true", "vps-id": vps.vps_id, "user-id": str(vps.user_id)},
        )
        vps.container_id = container.id
    except Exception as e:
        vps.status = "error"
        await db.commit()
        logger.error(f"Failed to create container during reinstall for VPS {vps.vps_id}: {e}")
        return

    await _wait_for_container_ready(container.id)

    setup_cmds = [
        "systemctl enable ssh || true",
        "systemctl start ssh || true",
        "mkdir -p /run/sshd /root/.ssh",
        "ssh-keygen -A || true",
    ]
    for cmd in setup_cmds:
        try:
            client.containers.get(vps.container_id).exec_run(
                ["bash", "-c", cmd], timeout=30
            )
        except Exception:
            pass

    vps.status = "running"
    vps.root_password_hash = root_password
    vps.restart_count += 1
    vps.last_restart = datetime.now(timezone.utc)
    vps.updated_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info(f"VPS {vps.vps_id} reinstalled")


async def exec_in_container(container_id: str, command: str, timeout: int = 60) -> tuple[int, str]:
    client = _get_docker_client()
    try:
        container = client.containers.get(container_id)
        exit_code, output = container.exec_run(
            cmd=["bash", "-c", command],
            demux=True,
            timeout=timeout,
        )
        stdout = output[0].decode("utf-8", errors="replace") if output[0] else ""
        stderr = output[1].decode("utf-8", errors="replace") if output[1] else ""
        result = stdout
        if stderr:
            result += f"\n[stderr] {stderr}"
        return exit_code, result.strip()
    except NotFound:
        return 1, "Container not found"
    except Exception as e:
        return 1, f"Error: {e}"


async def get_container_metrics(container_id: str) -> Optional[dict]:
    client = _get_docker_client()
    try:
        container = client.containers.get(container_id)
        stats = container.stats(stream=False)
    except Exception as e:
        logger.error(f"Failed to get container stats: {e}")
        return None

    cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                stats["precpu_stats"]["cpu_usage"]["total_usage"]
    system_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                   stats["precpu_stats"]["system_cpu_usage"]
    num_cpus = stats["cpu_stats"].get("online_cpus", 1)
    cpu_percent = (cpu_delta / system_delta) * num_cpus * 100.0 if system_delta > 0 else 0.0

    mem_usage = stats["memory_stats"].get("usage", 0)
    mem_limit = stats["memory_stats"].get("limit", 0)
    mem_cache = stats["memory_stats"].get("stats", {}).get("cache", 0)
    mem_actual = mem_usage - mem_cache if mem_usage > mem_cache else mem_usage

    networks = stats.get("networks", {})
    rx_bytes = sum(v.get("rx_bytes", 0) for v in networks.values())
    tx_bytes = sum(v.get("tx_bytes", 0) for v in networks.values())

    pids = stats.get("pids_stats", {}).get("current", 0)

    return {
        "cpu_percent": round(cpu_percent, 2),
        "memory_used_mb": round(mem_actual / (1024 * 1024)),
        "memory_limit_mb": round(mem_limit / (1024 * 1024)),
        "memory_percent": round((mem_actual / mem_limit) * 100, 2) if mem_limit > 0 else 0.0,
        "network_rx_bytes": rx_bytes,
        "network_tx_bytes": tx_bytes,
        "pids": pids,
        "uptime_seconds": 0,
    }


async def get_disk_usage(container_id: str) -> dict:
    exit_code, output = await exec_in_container(container_id, "df -B1 / | tail -1", timeout=5)
    if exit_code == 0 and output:
        parts = output.split()
        if len(parts) >= 4:
            try:
                total = int(parts[1]) / (1024 ** 3)
                used = int(parts[2]) / (1024 ** 3)
                percent = float(parts[4].rstrip("%"))
                return {
                    "total_gb": round(total, 2),
                    "used_gb": round(used, 2),
                    "percent": round(percent, 2),
                }
            except (ValueError, IndexError):
                pass
    return {"total_gb": 0, "used_gb": 0, "percent": 0}


def get_docker_client() -> docker.DockerClient:
    return docker.from_env()


async def get_tmate_session(container_id: str) -> Optional[str]:
    exit_code, _ = await exec_in_container(
        container_id,
        "tmate -S /tmp/tmate.sock kill-server || true",
        timeout=5,
    )
    await asyncio.sleep(1)

    exit_code, _ = await exec_in_container(
        container_id,
        "tmate -S /tmp/tmate.sock new-session -d",
        timeout=10,
    )
    if exit_code != 0:
        return None

    await asyncio.sleep(2)

    for attempt in range(5):
        exit_code, stdout = await exec_in_container(
            container_id,
            "tmate -S /tmp/tmate.sock display -p '#{tmate-ssh-proto} #{tmate-ssh-connect}'",
            timeout=10,
        )
        if exit_code == 0 and stdout and "ssh" in stdout.lower():
            return stdout.strip()
        await asyncio.sleep(1)

    return None


async def monitor_vps_containers():
    while True:
        try:
            client = _get_docker_client()
            async with async_session_maker() as db:
                result = await db.execute(
                    select(VPS).where(VPS.status.in_(["running", "stopped"]))
                )
                vps_list = result.scalars().all()

                for vps in vps_list:
                    if not vps.container_id:
                        continue
                    try:
                        container = client.containers.get(vps.container_id)
                        container.reload()
                        docker_status = container.status

                        if docker_status == "running" and vps.status != "running":
                            vps.status = "running"
                            logger.info(f"VPS {vps.vps_id} status synced to running")
                        elif docker_status == "exited" and vps.status == "running":
                            vps.status = "stopped"
                            logger.info(f"VPS {vps.vps_id} container stopped unexpectedly")
                        elif docker_status == "restarting":
                            pass
                    except NotFound:
                        if vps.status != "error":
                            vps.status = "error"
                            logger.warning(f"VPS {vps.vps_id} container not found in Docker")
                    except Exception as e:
                        logger.error(f"Error checking VPS {vps.vps_id}: {e}")

                await db.commit()
        except Exception as e:
            logger.error(f"Monitor loop error: {e}")

        await asyncio.sleep(settings.MONITORING_INTERVAL)


MINER_INDICATORS = [
    "xmrig",
    "minerd",
    "minergate",
    "ethminer",
    "cpuminer",
    "cgminer",
    "bfgminer",
    "stratum+tcp",
    "monero",
    "cryptonight",
    "hashrate",
    "pool.minexmr",
    "nicehash",
    "f2pool",
    "pool.",
]


async def anti_miner_check():
    while True:
        try:
            if not settings.ANTI_MINER_ENABLED:
                await asyncio.sleep(settings.ANTI_MINER_CHECK_INTERVAL)
                continue

            client = _get_docker_client()
            async with async_session_maker() as db:
                result = await db.execute(
                    select(VPS).where(VPS.status == "running")
                )
                vps_list = result.scalars().all()

                for vps in vps_list:
                    if not vps.container_id:
                        continue
                    try:
                        exit_code, output = await exec_in_container(
                            vps.container_id,
                            "ps aux 2>/dev/null",
                            timeout=10,
                        )
                        if exit_code != 0:
                            continue

                        output_lower = output.lower()
                        for indicator in MINER_INDICATORS:
                            if indicator in output_lower:
                                logger.warning(
                                    f"Potential miner detected on VPS {vps.vps_id}: "
                                    f"matched '{indicator}'"
                                )
                                await exec_in_container(
                                    vps.container_id,
                                    "pkill -f xmrig; pkill -f minerd; pkill -f cpuminer; "
                                    "pkill -f cgminer; pkill -f bfgminer; pkill -f ethminer; "
                                    "pkill -f minergate",
                                    timeout=10,
                                )
                                break
                    except Exception as e:
                        logger.error(f"Anti-miner check error for VPS {vps.vps_id}: {e}")

        except Exception as e:
            logger.error(f"Anti-miner loop error: {e}")

        await asyncio.sleep(settings.ANTI_MINER_CHECK_INTERVAL)
