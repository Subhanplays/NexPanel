import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import psutil
from sqlalchemy import select

from app.config import settings
from app.database import async_session_maker
from app.models.models import VPS
from app.services.vps_service import exec_in_container

logger = logging.getLogger(__name__)


class MonitoringError(Exception):
    pass


class MonitoringService:
    def __init__(self):
        self._collection_task: Optional[asyncio.Task] = None

    async def get_container_stats(self, container_id: str) -> dict:
        try:
            import docker
            client = docker.from_env()
            container = client.containers.get(container_id)
            stats = container.stats(stream=False)
        except Exception as e:
            raise MonitoringError(f"Failed to get container stats: {e}")

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
            "memory_usage_mb": round(mem_actual / (1024 * 1024), 2),
            "memory_limit_mb": round(mem_limit / (1024 * 1024), 2),
            "memory_percent": round((mem_actual / mem_limit) * 100, 2) if mem_limit > 0 else 0.0,
            "network_rx_bytes": rx_bytes,
            "network_tx_bytes": tx_bytes,
            "pids": pids,
        }

    async def get_system_stats(self) -> dict:
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()

        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        disk = psutil.disk_usage("/")
        net = psutil.net_io_counters()
        boot_time = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time)
        load_avg = psutil.getloadavg()

        return {
            "cpu_percent": round(cpu_percent, 2),
            "cpu_count": cpu_count,
            "cpu_freq_current": round(cpu_freq.current, 0) if cpu_freq else None,
            "cpu_freq_max": round(cpu_freq.max, 0) if cpu_freq else None,
            "load_avg_1": round(load_avg[0], 2),
            "load_avg_5": round(load_avg[1], 2),
            "load_avg_15": round(load_avg[2], 2),
            "memory_total_gb": round(mem.total / (1024 ** 3), 2),
            "memory_used_gb": round(mem.used / (1024 ** 3), 2),
            "memory_available_gb": round(mem.available / (1024 ** 3), 2),
            "memory_percent": round(mem.percent, 2),
            "swap_total_gb": round(swap.total / (1024 ** 3), 2),
            "swap_used_gb": round(swap.used / (1024 ** 3), 2),
            "swap_percent": round(swap.percent, 2),
            "disk_total_gb": round(disk.total / (1024 ** 3), 2),
            "disk_used_gb": round(disk.used / (1024 ** 3), 2),
            "disk_free_gb": round(disk.free / (1024 ** 3), 2),
            "disk_percent": round(disk.percent, 2),
            "network_rx_bytes": net.bytes_recv,
            "network_tx_bytes": net.bytes_sent,
            "network_rx_packets": net.packets_recv,
            "network_tx_packets": net.packets_sent,
            "uptime_seconds": uptime_seconds,
            "uptime_human": self._format_uptime(uptime_seconds),
            "boot_time": datetime.fromtimestamp(boot_time, tz=timezone.utc).isoformat(),
        }

    async def get_vps_uptime(self, vps_id: str) -> dict:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.vps_id == vps_id)
            )
            vps = result.scalar_one_or_none()
            if not vps:
                return {"vps_id": vps_id, "status": "not_found", "uptime_seconds": 0}

        try:
            import docker
            client = docker.from_env()
            container = client.containers.get(vps.container_id)
            container.reload()
            state = container.attrs.get("State", {})
            started_at = state.get("StartedAt")

            if started_at and state.get("Running"):
                from dateutil.parser import parse as parse_dt
                start_dt = parse_dt(started_at)
                uptime_secs = int((datetime.now(timezone.utc) - start_dt).total_seconds())
                return {
                    "vps_id": vps_id,
                    "status": container.status,
                    "started_at": started_at,
                    "uptime_seconds": uptime_secs,
                    "uptime_human": self._format_uptime(uptime_secs),
                }
            else:
                return {
                    "vps_id": vps_id,
                    "status": container.status if container else "not_found",
                    "started_at": started_at,
                    "uptime_seconds": 0,
                    "uptime_human": "not running",
                }
        except Exception as e:
            return {
                "vps_id": vps_id,
                "status": "unknown",
                "uptime_seconds": 0,
                "uptime_human": "unknown",
                "error": str(e),
            }

    async def collect_all_metrics(self) -> list[dict]:
        async with async_session_maker() as session:
            result = await session.execute(
                select(VPS).where(VPS.status == "running")
            )
            vps_list = result.scalars().all()

        results = []
        for vps in vps_list:
            try:
                stats = await self.get_container_stats(vps.container_id)
                exit_code, df_output = await exec_in_container(
                    vps.container_id, "df -BG / | tail -1", timeout=5
                )
                disk_used_gb = 0.0
                if exit_code == 0 and df_output:
                    parts = df_output.split()
                    if len(parts) >= 3:
                        try:
                            disk_used_gb = float(parts[2].rstrip("G"))
                        except ValueError:
                            pass

                results.append({
                    "vps_id": vps.vps_id,
                    "cpu_percent": stats["cpu_percent"],
                    "memory_usage_mb": stats["memory_usage_mb"],
                    "memory_limit_mb": stats["memory_limit_mb"],
                    "disk_used_gb": disk_used_gb,
                    "disk_limit_gb": vps.disk_gb,
                })
            except Exception as e:
                logger.error(f"Failed to collect metrics for VPS {vps.vps_id}: {e}")

        return results

    async def start_periodic_collection(self, interval: Optional[int] = None) -> None:
        if self._collection_task and not self._collection_task.done():
            return

        interval = interval or settings.MONITORING_INTERVAL

        async def _loop():
            while True:
                try:
                    await self.collect_all_metrics()
                except Exception as e:
                    logger.error(f"Metrics collection error: {e}")
                await asyncio.sleep(interval)

        self._collection_task = asyncio.create_task(_loop())
        logger.info(f"Started periodic metrics collection every {interval}s")

    async def stop_periodic_collection(self) -> None:
        if self._collection_task and not self._collection_task.done():
            self._collection_task.cancel()
            try:
                await self._collection_task
            except asyncio.CancelledError:
                pass
            logger.info("Stopped periodic metrics collection")

    @staticmethod
    def _format_uptime(seconds: int) -> str:
        days = seconds // 86400
        hours = (seconds % 86400) // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        parts = []
        if days > 0:
            parts.append(f"{days}d")
        if hours > 0:
            parts.append(f"{hours}h")
        if minutes > 0:
            parts.append(f"{minutes}m")
        parts.append(f"{secs}s")
        return " ".join(parts)


monitoring_service = MonitoringService()
