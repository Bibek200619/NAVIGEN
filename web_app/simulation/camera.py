"""Software camera using the same off-road height field and vehicle attitude."""

from io import BytesIO
from math import cos, sin

from environments import height_at
from PIL import Image, ImageDraw

WIDTH, HEIGHT, FOCAL = 640, 360, 420


def render_camera(state):
    environment = state["environment"]
    config, colors = environment["config"], environment["colors"]
    image = Image.new("RGB", (WIDTH, HEIGHT), colors["sky"])
    draw = ImageDraw.Draw(image)
    horizon = 170
    draw.rectangle((0, horizon, WIDTH, HEIGHT), fill=colors["ground"])
    px, py, yaw = state["position_x"], state["position_y"], state["yaw"]
    pitch, roll = state["pitch"], state["roll"]
    pz = state["position_z"] + 1.25
    forward, right = (cos(yaw), sin(yaw)), (-sin(yaw), cos(yaw))

    def view(point):
        x, y, z = point
        dx, dy, dz = x - px, y - py, z - pz
        across = dx * right[0] + dy * right[1]
        depth = dx * forward[0] + dy * forward[1]
        vertical = dz * cos(pitch) - depth * sin(pitch)
        depth = depth * cos(pitch) + dz * sin(pitch)
        return (
            across * cos(roll) + vertical * sin(roll),
            vertical * cos(roll) - across * sin(roll),
            depth,
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

    faces = []

    def face(vertices, color, brightness=1):
        vv = [view(p) for p in vertices]
        if all(v[2] < 0.12 for v in vv):
            return
        polygon = clip(vv)
        if len(polygon) < 3:
            return
        depth = sum(v[2] for v in vv) / len(vv)
        fog = min(0.6, max(0, depth - 8) / (60 if config["weather"] == "mist" else 180))
        sky = tuple(int(colors["sky"][k : k + 2], 16) for k in (1, 3, 5))
        rgb = tuple(
            min(
                255,
                max(
                    0,
                    int(
                        int(color[k : k + 2], 16) * brightness * (1 - fog)
                        + sky[i] * fog
                    ),
                ),
            )
            for i, k in enumerate((1, 3, 5))
        )
        faces.append((depth, [project(v) for v in polygon], rgb))

    bx, by = [int(v) for v in environment["bounds"]]
    for x in range(-bx, bx, 2):
        for y in range(-by, by, 2):
            vertices = [
                (a, b, height_at(config, a, b))
                for a, b in ((x, y), (x + 2, y), (x + 2, y + 2), (x, y + 2))
            ]
            shade = (
                0.92
                + 0.08 * sin(x * 3.7 + y * 2.1)
                + (vertices[0][2] - vertices[2][2]) * 0.08
            )
            face(vertices, colors["ground"], shade)

    objects = list(state["objects"])
    if state["obstacle"]:
        ob = state["obstacle"]
        objects.append([ob["x"], ob["y"], 1.1, 1.1, 0.9, "#b48852", "rock"])
    for x, y, w, d, h, color, kind in objects:
        ground = height_at(config, x, y)
        if kind == "tree":
            layers = [
                (w * 0.22, d * 0.22, ground, ground + h * 0.6, "#6a5944"),
                (w * 1.4, d * 1.4, ground + h * 0.25, ground + h, "#344f38"),
            ]
        else:
            layers = [(w, d, ground - 0.1, ground + h, color)]
        for width, depth, base, top, tint in layers:
            corners = [
                (x + sx * width / 2, y + sy * depth / 2, base)
                for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))
            ]
            peak = (x - width * 0.08, y + depth * 0.1, top)
            for i in range(4):
                face(
                    [corners[i], corners[(i + 1) % 4], peak],
                    tint,
                    (0.85, 1.03, 0.75, 0.95)[i],
                )

    for _, polygon, color in sorted(faces, key=lambda item: item[0], reverse=True):
        draw.polygon(polygon, fill=color)
    if config["weather"] == "rain":
        tick = int(state["elapsed_seconds"] * 12)
        for i in range(40):
            x, y = (i * 137 + tick * 7) % WIDTH, (i * 61 + tick * 23) % HEIGHT
            draw.line((x, y, x - 3, y + 12), fill="#a7b5b5")
    draw.polygon(
        [(210, HEIGHT), (250, HEIGHT - 55), (390, HEIGHT - 55), (430, HEIGHT)],
        fill="#44523b",
    )
    draw.rectangle((0, 0, WIDTH, 28), fill="#24311f")
    draw.text((14, 8), "NAVIGEN  /  SIMULATED FRONT CAMERA", fill="#f1f5ec")
    draw.rectangle((0, HEIGHT - 28, WIDTH, HEIGHT), fill="#24311f")
    draw.text(
        (14, HEIGHT - 19),
        f"{state['linear_velocity']:.2f} m/s  |  ALT {state['position_z']:.1f} m  |  {state['status'].upper()}",
        fill="#f1f5ec",
    )
    draw.line((310, 170, 330, 170), fill="#f7faee")
    draw.line((320, 160, 320, 180), fill="#f7faee")
    output = BytesIO()
    image.save(output, format="JPEG", quality=80)
    return output.getvalue()
