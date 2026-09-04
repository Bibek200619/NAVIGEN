# Command contract v1

Initial command types: `set_goal`, `software_estop`.

Lifecycle: `pending` -> `accepted` -> `executed`; terminal alternatives are `rejected` and `failed`.

Create endpoint: `POST /api/v1/robots/{robot_id}/commands` (operator or admin).

Request fields are optional `mission_id`, canonical `command_type`, and `payload`. The path is the
single source for `robot_id`. `set_goal.payload` uses nested `position` and `orientation` vectors as
shown in the example. `software_estop.payload` only permits `{ "active": true }`; the Web API does
not release physical or software e-stop state.

Every accepted API request is first persisted as `pending`. Safety or integration precondition
failures become persisted `rejected` records with a machine-readable `rejection_reason`.

An optional `Idempotency-Key` header (8–128 characters) makes exact retries return the same command
record. Reusing the key for different command content is a conflict.
