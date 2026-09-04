from dataclasses import dataclass
from uuid import UUID

from app.core.constants import UserRole


@dataclass(frozen=True, slots=True)
class CurrentUser:
    user_id: UUID
    email: str | None
    role: UserRole
