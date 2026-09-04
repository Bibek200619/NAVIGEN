import httpx
import pytest

from app.core.errors import DatabaseError
from app.db.client import SupabaseDatabaseClient


@pytest.mark.asyncio
async def test_supabase_http_error_is_converted() -> None:
    def fail(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"message": "internal database detail"})

    database = SupabaseDatabaseClient("https://example.supabase.co", "secret")
    await database._client.aclose()
    database._client = httpx.AsyncClient(  # noqa: SLF001
        base_url="https://example.supabase.co", transport=httpx.MockTransport(fail)
    )
    with pytest.raises(DatabaseError) as error:
        await database.select("robots")
    assert error.value.code == "DATABASE_ERROR"
    assert "internal database detail" not in error.value.message
    await database.close()
