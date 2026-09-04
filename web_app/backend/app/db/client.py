import logging
from collections.abc import Mapping, Sequence
from uuid import UUID

import httpx

from app.core.errors import AuthenticationError, DatabaseError
from app.core.types import JsonValue

logger = logging.getLogger(__name__)
Row = dict[str, JsonValue]


class SupabaseDatabaseClient:
    def __init__(self, url: str, service_role_key: str, *, timeout: float = 10.0) -> None:
        self._configured = bool(url and service_role_key)
        self._client = httpx.AsyncClient(
            base_url=url.rstrip("/") if url else "http://supabase.invalid",
            timeout=timeout,
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Accept": "application/json",
            },
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def health(self) -> bool:
        if not self._configured:
            return False
        try:
            await self.select("robots", columns="id", limit=1)
        except DatabaseError:
            return False
        return True

    async def select(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: Mapping[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> tuple[list[Row], int | None]:
        params: list[tuple[str, str]] = [("select", columns)]
        params.extend((key, value) for key, value in (filters or {}).items())
        if order:
            params.append(("order", order))
        if limit is not None:
            params.extend((("limit", str(limit)), ("offset", str(offset))))
        response = await self._request(
            "GET", table, params=params, headers={"Prefer": "count=exact"}
        )
        data = response.json()
        if not isinstance(data, list):
            raise DatabaseError()
        total = self._parse_total(response.headers.get("content-range"))
        return [dict(row) for row in data if isinstance(row, dict)], total

    async def insert(self, table: str, values: Row | Sequence[Row]) -> list[Row]:
        response = await self._request(
            "POST", table, json=values, headers={"Prefer": "return=representation"}
        )
        return self._rows(response)

    async def update(self, table: str, values: Row, filters: Mapping[str, str]) -> list[Row]:
        response = await self._request(
            "PATCH",
            table,
            params=list(filters.items()),
            json=values,
            headers={"Prefer": "return=representation"},
        )
        return self._rows(response)

    async def upsert(
        self, table: str, values: Row, *, on_conflict: str
    ) -> list[Row]:
        response = await self._request(
            "POST",
            table,
            params=[("on_conflict", on_conflict)],
            json=values,
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        return self._rows(response)

    async def delete(self, table: str, filters: Mapping[str, str]) -> None:
        await self._request("DELETE", table, params=list(filters.items()))

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: Mapping[str, str] | Sequence[tuple[str, str]] | None = None,
        json: object | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> httpx.Response:
        if not self._configured:
            raise DatabaseError("Supabase is not configured.")
        request_params: httpx.QueryParams | None = None
        if params is not None:
            raw_params = list(params.items()) if isinstance(params, Mapping) else list(params)
            request_params = httpx.QueryParams(dict(raw_params))
        try:
            response = await self._client.request(
                method,
                f"/rest/v1/{table}",
                params=request_params,
                json=json,
                headers=headers,
            )
            response.raise_for_status()
            return response
        except (httpx.HTTPError, ValueError) as exc:
            status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
            logger.exception(
                "Supabase operation failed",
                extra={"source": "database", "event_code": "DATABASE_ERROR", "status": status},
            )
            raise DatabaseError() from exc

    @staticmethod
    def _rows(response: httpx.Response) -> list[Row]:
        data = response.json()
        if not isinstance(data, list):
            raise DatabaseError()
        return [dict(row) for row in data if isinstance(row, dict)]

    @staticmethod
    def _parse_total(content_range: str | None) -> int | None:
        if not content_range or "/" not in content_range:
            return None
        value = content_range.rsplit("/", 1)[-1]
        return int(value) if value.isdigit() else None


class SupabaseAuthClient:
    def __init__(self, url: str, publishable_key: str, *, timeout: float = 5.0) -> None:
        self._configured = bool(url and publishable_key)
        self._client = httpx.AsyncClient(
            base_url=url.rstrip("/") if url else "http://supabase.invalid", timeout=timeout
        )
        self._publishable_key = publishable_key

    async def close(self) -> None:
        await self._client.aclose()

    async def get_user(self, access_token: str) -> tuple[UUID, str | None]:
        if not self._configured:
            raise AuthenticationError("Supabase Auth is not configured.")
        try:
            response = await self._client.get(
                "/auth/v1/user",
                headers={
                    "apikey": self._publishable_key,
                    "Authorization": f"Bearer {access_token}",
                },
            )
            if response.status_code in {401, 403}:
                raise AuthenticationError("The access token is invalid or expired.")
            response.raise_for_status()
            payload: object = response.json()
            if not isinstance(payload, dict):
                raise AuthenticationError("Supabase Auth returned an invalid user response.")
            raw_user_id = payload.get("id")
            email = payload.get("email")
            if not isinstance(raw_user_id, str) or not (
                email is None or isinstance(email, str)
            ):
                raise AuthenticationError("Supabase Auth returned an invalid user response.")
            return UUID(raw_user_id), email
        except AuthenticationError:
            raise
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            raise AuthenticationError("Unable to validate the access token.") from exc
