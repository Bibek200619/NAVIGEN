# Mission contract v1

Mission lifecycle: `pending` -> `in_progress` -> `completed`; terminal alternatives are `failed` and `aborted`.

Allowed transitions:

- `pending` -> `in_progress`, `failed`, or `aborted`
- `in_progress` -> `completed`, `failed`, or `aborted`
- terminal states do not transition

Mission creation uses canonical `robot_id`, `name`, optional `description`, and optional `goals`.
Goal sequence numbers are zero-based when assigned by the backend. Goal pose fields are flat
`frame_id`, `position_x/y/z`, and `orientation_x/y/z/w`; every numeric value must be finite and the
quaternion must be normalized.
