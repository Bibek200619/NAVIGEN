"""Software-rendered camera from the same simulated pose and scene as the 3D world."""

from io import BytesIO
from math import cos, sin

from engine import OBJECTS
from PIL import Image, ImageDraw

WIDTH, HEIGHT = 640, 360
FOCAL = 420


def render_camera(state):
    image = Image.new("RGB", (WIDTH, HEIGHT), "#e3e7df")
    draw = ImageDraw.Draw(image)
    horizon = 152
    draw.rectangle((0, horizon, WIDTH, HEIGHT), fill="#acb6a1")
    px, py, yaw = state["position_x"], state["position_y"], state["yaw"]
    forward = (cos(yaw), sin(yaw))
    right = (-sin(yaw), cos(yaw))

    def view(point):
        x, y, z = point
        dx, dy = x - px, y - py
        return (
            dx * right[0] + dy * right[1],
            z - 0.9,
            dx * forward[0] + dy * forward[1],
        )

    def project(v):
        return (
            max(-4000, min(4000, WIDTH / 2 + FOCAL * v[0] / v[2])),
            max(-4000, min(4000, horizon - FOCAL * v[1] / v[2])),
        )

    def clip(poly):
        out = []
        for i, a in enumerate(poly):
            b = poly[(i + 1) % len(poly)]
            ai, bi = a[2] >= 0.12, b[2] >= 0.12
            if ai:
                out.append(a)
            if ai != bi:
                t = (0.12 - a[2]) / (b[2] - a[2])
                out.append(tuple(a[j] + t * (b[j] - a[j]) for j in range(3)))
        return out

    # Ground grid gives a useful visual motion cue, without claiming a real camera image.
    for axis in range(-12, 13, 2):
        for points in [
            [(axis, -10, 0.005), (axis, 10, 0.005)],
            [(-12, axis, 0.005), (12, axis, 0.005)],
        ]:
            a, b = [view(p) for p in points]
            if a[2] < 0.12 and b[2] < 0.12:
                continue
            if a[2] < 0.12 or b[2] < 0.12:
                if b[2] < 0.12:
                    a, b = b, a
                t = (0.12 - a[2]) / (b[2] - a[2])
                a = tuple(a[j] + t * (b[j] - a[j]) for j in range(3))
            draw.line([project(a), project(b)], fill="#89977e", width=1)

    objects = list(OBJECTS) + [
        [0, -10, 24, 0.15, 3, "#c7cfc0", "wall"],
        [0, 10, 24, 0.15, 3, "#c7cfc0", "wall"],
        [-12, 0, 0.15, 20, 3, "#c7cfc0", "wall"],
        [12, 0, 0.15, 20, 3, "#c7cfc0", "wall"],
    ]
    if state["obstacle"]:
        ob = state["obstacle"]
        objects.append([ob["x"], ob["y"], 1.1, 1.1, 0.9, "#db8b43", "obstacle"])
    faces = []
    for x, y, w, d, h, color, kind in objects:
        vertices = [
            (x + sx * w / 2, y + sy * d / 2, z)
            for z in (0, h)
            for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))
        ]
        for face, brightness in [
            ((0, 1, 5, 4), 0.82),
            ((1, 2, 6, 5), 0.95),
            ((2, 3, 7, 6), 0.85),
            ((3, 0, 4, 7), 1),
            ((4, 5, 6, 7), 1.1),
        ]:
            vv = [view(vertices[i]) for i in face]
            polygon = clip(vv)
            if len(polygon) < 3:
                continue
            rgb = tuple(
                min(255, int(int(color[k : k + 2], 16) * brightness)) for k in (1, 3, 5)
            )
            faces.append(
                (sum(v[2] for v in vv) / 4, [project(v) for v in polygon], rgb, kind)
            )
    for _, polygon, color, kind in sorted(
        faces, key=lambda item: item[0], reverse=True
    ):
        draw.polygon(polygon, fill=color, outline="#69755e")
        if kind == "rack":
            # Perspective horizontal shelves.
            for ratio in (0.35, 0.7):
                if len(polygon) == 4:
                    a, b, c, d = polygon
                    draw.line(
                        [
                            (
                                a[0] + (d[0] - a[0]) * ratio,
                                a[1] + (d[1] - a[1]) * ratio,
                            ),
                            (
                                b[0] + (c[0] - b[0]) * ratio,
                                b[1] + (c[1] - b[1]) * ratio,
                            ),
                        ],
                        fill="#5c6a50",
                        width=3,
                    )
    draw.rectangle((0, 0, WIDTH, 28), fill="#24311f")
    draw.text((14, 8), "NAVIGEN  /  SIMULATED FRONT CAMERA", fill="#f1f5ec")
    draw.rectangle((0, HEIGHT - 28, WIDTH, HEIGHT), fill="#24311f")
    draw.text(
        (14, HEIGHT - 19),
        f"{state['linear_velocity']:.2f} m/s   |   {state['status'].upper()}   |   SIMULATION",
        fill="#f1f5ec",
    )
    # Vehicle nose, plus a reticle for camera orientation.
    draw.polygon(
        [
            (230, HEIGHT - 28),
            (267, HEIGHT - 47),
            (373, HEIGHT - 47),
            (410, HEIGHT - 28),
        ],
        fill="#445835",
    )
    draw.line((310, 180, 330, 180), fill="#f7faee")
    draw.line((320, 170, 320, 190), fill="#f7faee")
    output = BytesIO()
    image.save(output, format="JPEG", quality=80)
    return output.getvalue()
