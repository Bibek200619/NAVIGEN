from uuid import UUID

from app.core.errors import NotFoundError
from app.repositories.robots import RobotRepository
from app.schemas.common import Page
from app.schemas.robot import RobotResponse


class RobotService:
    def __init__(self, robots: RobotRepository) -> None:
        self.robots = robots

    async def list(self, *, limit: int, offset: int) -> Page[RobotResponse]:
        rows, total = await self.robots.list(limit=limit, offset=offset)
        return Page(
            items=[RobotResponse.model_validate(row) for row in rows],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get(self, robot_id: UUID) -> RobotResponse:
        row = await self.robots.get(robot_id)
        if row is None:
            raise NotFoundError("ROBOT_NOT_FOUND", "Robot not found.")
        return RobotResponse.model_validate(row)
