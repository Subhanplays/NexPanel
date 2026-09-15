from __future__ import annotations

import logging
from typing import Any, Optional

import aiohttp

from bot.config import API_BASE_URL, API_KEY

logger = logging.getLogger(__name__)


class APIError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(f"[{status}] {detail}")


class APIClient:
    def __init__(self, base_url: str = API_BASE_URL, api_key: str = API_KEY):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    def _headers(self, user_token: Optional[str] = None) -> dict[str, str]:
        h: dict[str, str] = {"Content-Type": "application/json"}
        if user_token:
            h["Authorization"] = f"Bearer {user_token}"
        elif self.api_key:
            h["X-API-Key"] = self.api_key
        return h

    async def _request(
        self,
        method: str,
        path: str,
        *,
        user_token: Optional[str] = None,
        json: Any = None,
        params: Any = None,
    ) -> Any:
        session = await self._get_session()
        url = f"{self.base_url}{path}"
        headers = self._headers(user_token)

        try:
            async with session.request(
                method, url, headers=headers, json=json, params=params
            ) as resp:
                body = await resp.json()
                if resp.status >= 400:
                    detail = body.get("detail", str(body))
                    raise APIError(resp.status, detail)
                return body
        except aiohttp.ClientError as exc:
            logger.error("API request failed: %s", exc)
            raise APIError(0, str(exc))

    # ── Auth ──────────────────────────────────────────────────
    async def login(self, username: str, password: str) -> dict:
        return await self._request(
            "POST", "/auth/login", json={"username": username, "password": password}
        )

    async def get_me(self, user_token: str) -> dict:
        return await self._request("GET", "/auth/me", user_token=user_token)

    # ── VPS ───────────────────────────────────────────────────
    async def list_vps(self, user_token: str, **kwargs: Any) -> list[dict]:
        return await self._request(
            "GET", "/vps/", user_token=user_token, params=kwargs
        )

    async def get_vps(self, user_token: str, vps_id: str) -> dict:
        return await self._request("GET", f"/vps/{vps_id}", user_token=user_token)

    async def create_vps(self, user_token: str, data: dict) -> dict:
        return await self._request("POST", "/vps/", user_token=user_token, json=data)

    async def update_vps(self, user_token: str, vps_id: str, data: dict) -> dict:
        return await self._request(
            "PUT", f"/vps/{vps_id}", user_token=user_token, json=data
        )

    async def delete_vps(self, user_token: str, vps_id: str) -> dict:
        return await self._request(
            "DELETE", f"/vps/{vps_id}", user_token=user_token
        )

    async def start_vps(self, user_token: str, vps_id: str) -> dict:
        return await self._request(
            "POST", f"/vps/{vps_id}/start", user_token=user_token
        )

    async def stop_vps(self, user_token: str, vps_id: str) -> dict:
        return await self._request(
            "POST", f"/vps/{vps_id}/stop", user_token=user_token
        )

    async def restart_vps(self, user_token: str, vps_id: str) -> dict:
        return await self._request(
            "POST", f"/vps/{vps_id}/restart", user_token=user_token
        )

    async def reinstall_vps(self, user_token: str, vps_id: str, password: str) -> dict:
        return await self._request(
            "POST",
            f"/vps/{vps_id}/reinstall",
            user_token=user_token,
            params={"password": password},
        )

    async def get_vps_metrics(self, user_token: str, vps_id: str) -> dict:
        return await self._request(
            "GET", f"/vps/{vps_id}/metrics", user_token=user_token
        )

    async def get_vps_token(self, user_token: str, vps_id: str) -> dict:
        return await self._request(
            "GET", f"/vps/{vps_id}/token", user_token=user_token
        )

    async def list_deployments(self, user_token: str, vps_id: str) -> list[dict]:
        return await self._request(
            "GET", f"/vps/{vps_id}/deployments", user_token=user_token
        )

    async def exec_command(
        self, user_token: str, vps_id: str, command: str
    ) -> dict:
        return await self._request(
            "POST",
            f"/vps/{vps_id}/exec",
            user_token=user_token,
            params={"command": command},
        )

    # ── Admin ─────────────────────────────────────────────────
    async def admin_list_users(
        self, user_token: str, **kwargs: Any
    ) -> list[dict]:
        return await self._request(
            "GET", "/admin/users", user_token=user_token, params=kwargs
        )

    async def admin_list_vps(
        self, user_token: str, **kwargs: Any
    ) -> list[dict]:
        return await self._request(
            "GET", "/admin/vps", user_token=user_token, params=kwargs
        )

    async def admin_vps_stats(self, user_token: str) -> dict:
        return await self._request(
            "GET", "/admin/vps/stats", user_token=user_token
        )

    async def admin_list_images(self, user_token: str) -> list[dict]:
        return await self._request(
            "GET", "/admin/images", user_token=user_token
        )

    async def admin_list_hosts(self, user_token: str) -> list[dict]:
        return await self._request(
            "GET", "/admin/hosts", user_token=user_token
        )


api_client = APIClient()
