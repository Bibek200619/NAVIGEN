from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.constants import LocalizationState, MissionStatus, SafetyState, UserRole
from app.core.errors import AuthorizationError, ConflictError
from app.core.security import CurrentUser
from app.schemas.mission import MissionGoalCreate
from app.services.mission_service import validate_mission_transition
from app.services.telemetry_service import calculate_freshness
from app.ugv_integration.mappers import map_localization_state, map_safety_state


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (MissionStatus.PENDING, MissionStatus.IN_PROGRESS),
        (MissionStatus.PENDING, MissionStatus.ABORTED),
        (MissionStatus.IN_PROGRESS, MissionStatus.COMPLETED),
        (MissionStatus.IN_PROGRESS, MissionStatus.FAILED),
    ],
)
def test_valid_mission_transitions(current: MissionStatus, target: MissionStatus) -> None:
    validate_mission_transition(current, target)


def test_terminal_mission_cannot_restart() -> None:
    with pytest.raises(ConflictError) as error:
        validate_mission_transition(MissionStatus.COMPLETED, MissionStatus.IN_PROGRESS)
    assert error.value.code == "MISSION_INVALID_STATE"


def test_goal_rejects_non_normalized_quaternion() -> None:
    with pytest.raises(ValidationError):
        MissionGoalCreate(
            position_x=1,
            position_y=2,
            orientation_z=0,
            orientation_w=2,
        )


def test_goal_rejects_non_finite_position() -> None:
    with pytest.raises(ValidationError):
        MissionGoalCreate(
            position_x=float("nan"),
            position_y=2,
            orientation_z=0,
            orientation_w=1,
        )


def test_state_mappings_are_readable() -> None:
    assert map_safety_state(2) is SafetyState.EMERGENCY_STOP
    assert map_localization_state(3) is LocalizationState.RELOCALIZING
    with pytest.raises(ValueError):
        map_safety_state(99)
    with pytest.raises(ValueError):
        map_localization_state(99)


def test_telemetry_freshness_threshold() -> None:
    now = datetime.now(UTC)
    age, stale = calculate_freshness(
        now - timedelta(milliseconds=2001), now=now, stale_threshold_ms=2000
    )
    assert age == 2001
    assert stale is True
    _, fresh = calculate_freshness(now, now=now, stale_threshold_ms=2000)
    assert fresh is False


@pytest.mark.asyncio
async def test_role_authorization_rejects_viewer() -> None:
    from app.api.dependencies import require_operator

    viewer = CurrentUser(user_id=uuid4(), email=None, role=UserRole.VIEWER)
    with pytest.raises(AuthorizationError):
        await require_operator(viewer)
