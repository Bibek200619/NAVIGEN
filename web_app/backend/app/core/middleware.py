import logging
from uuid import UUID, uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.logging import request_id_context

logger = logging.getLogger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        supplied = request.headers.get("X-Request-ID")
        try:
            request_id = str(UUID(supplied)) if supplied else str(uuid4())
        except ValueError:
            request_id = str(uuid4())
        request.state.request_id = request_id
        token = request_id_context.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_context.reset(token)
        response.headers["X-Request-ID"] = request_id
        return response


def request_id_from(request: Request) -> str:
    return str(getattr(request.state, "request_id", uuid4()))
