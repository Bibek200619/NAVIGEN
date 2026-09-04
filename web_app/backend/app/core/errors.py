from collections.abc import Mapping

from app.core.types import JsonValue


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 400,
        details: Mapping[str, JsonValue] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = dict(details or {})


class AuthenticationError(AppError):
    def __init__(self, message: str = "Authentication is required.") -> None:
        super().__init__("UNAUTHENTICATED", message, status_code=401)


class AuthorizationError(AppError):
    def __init__(self, message: str = "You do not have permission for this action.") -> None:
        super().__init__("FORBIDDEN", message, status_code=403)


class NotFoundError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, status_code=404)


class ConflictError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, status_code=409)


class DatabaseError(AppError):
    def __init__(self, message: str = "A database operation failed.") -> None:
        super().__init__("DATABASE_ERROR", message, status_code=503)


class UGVBridgeError(AppError):
    def __init__(self, message: str = "The UGV bridge is unavailable.") -> None:
        super().__init__("UGV_BRIDGE_UNAVAILABLE", message, status_code=503)
