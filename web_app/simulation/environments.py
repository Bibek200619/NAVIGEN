"""Reproducible off-road demonstration terrain; dimensions are in metres."""

from math import cos, exp, hypot, sin
from random import Random
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

WORLD_BOUNDS = (24.0, 20.0)
START = (-16.0, -12.0)
PROFILES = ("mountain", "rocky", "forest")


class TerrainConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    name: str = Field(default="My field site", min_length=1, max_length=48)
    profile: Literal["mountain", "rocky", "forest"] = "mountain"
    relief: float = Field(default=7, ge=0, le=10)
    roughness: float = Field(default=0.35, ge=0, le=1)
    density: int = Field(default=24, ge=0, le=40)
    grip: float = Field(default=0.82, ge=0.35, le=1)
    seed: int = Field(default=42, ge=0, le=999999)
    weather: Literal["clear", "mist", "rain"] = "clear"

    @field_validator("name")
    @classmethod
    def trim_name(cls, value):
        if not value.strip():
            raise ValueError("Give the environment a name.")
        return value.strip()


PRESETS = {
    "mountain": TerrainConfig(
        name="Alpine ridge", relief=7, roughness=0.3, density=22, seed=42
    ),
    "rocky": TerrainConfig(
        name="Rocky badlands",
        profile="rocky",
        relief=3.2,
        roughness=0.85,
        density=34,
        grip=0.68,
        seed=81,
    ),
    "forest": TerrainConfig(
        name="Forest trail",
        profile="forest",
        relief=3.8,
        roughness=0.45,
        density=40,
        grip=0.76,
        seed=17,
        weather="mist",
    ),
}
DESCRIPTIONS = {
    "mountain": "Mountain slopes, exposed ridges, and scattered boulders.",
    "rocky": "Broken ground, loose gravel, and sandstone outcrops.",
    "forest": "Rolling woodland, narrow clearings, and wet soil.",
}
COLORS = {
    "mountain": {
        "ground": "#8d9279",
        "high": "#c3c2b5",
        "rock": "#8b8b81",
        "sky": "#ccdce2",
        "trail": "#b2a18a",
    },
    "rocky": {
        "ground": "#b99a73",
        "high": "#d9c4a1",
        "rock": "#947252",
        "sky": "#e0d9c9",
        "trail": "#c6af8c",
    },
    "forest": {
        "ground": "#627451",
        "high": "#8b986c",
        "rock": "#707b64",
        "sky": "#ced9cc",
        "trail": "#a09977",
    },
}


def height_at(config, x, y):
    """Kept identical to static/terrain.js; sampled by camera, chassis, and mesh."""
    phase = (config["seed"] % 97) / 17
    profile = config["profile"]
    rolling = 0.15 * sin(x * 0.16 + phase) + 0.12 * cos(y * 0.18 - phase)
    if profile == "mountain":
        land = 1.5 * exp(-((x + 3) ** 2 / 75 + (y - 2) ** 2 / 65))
        land += 0.8 * exp(-((x - 18) ** 2 / 55 + (y + 16) ** 2 / 85))
    elif profile == "rocky":
        land = 0.55 * sin(x * 0.18) * cos(y * 0.16) + 0.6
    else:
        land = 0.4 * sin(x * 0.1 + y * 0.13) + 0.5
    bumps = 0.16 * sin(x * 1.3 + phase) * cos(y * 1.1) + 0.08 * sin(x * 2.4 - y * 1.7)
    return config["relief"] * (0.32 + rolling + land) + config["roughness"] * bumps


def route_distance(x, y):
    """Distance to the four patrol legs, used to keep generated routes traversable."""
    return min(
        [hypot(max(abs(x) - 16, 0), abs(y - edge)) for edge in (-12, 12)]
        + [hypot(abs(x - edge), max(abs(y) - 12, 0)) for edge in (-16, 16)]
    )


def build_environment(environment_id, config):
    config = config.model_dump()
    random = Random(config["seed"])
    colors = COLORS[config["profile"]]
    objects = []
    for _ in range(3000):
        if len(objects) >= config["density"]:
            break
        x, y = random.uniform(-22, 22), random.uniform(-18, 18)
        kind = (
            "tree"
            if config["profile"] == "forest" and random.random() < 0.8
            else "rock"
        )
        w = random.uniform(0.8, 1.4) if kind == "tree" else random.uniform(1.1, 3.0)
        d = w * random.uniform(0.8, 1.2)
        if route_distance(x, y) < max(w, d) / 2 + 2.6:
            continue
        if any(hypot(x - ob[0], y - ob[1]) < (w + ob[2]) / 2 + 0.5 for ob in objects):
            continue
        h = random.uniform(3.5, 6.5) if kind == "tree" else random.uniform(0.7, 2.4)
        objects.append(
            [
                round(x, 3),
                round(y, 3),
                round(w, 3),
                round(d, 3),
                round(h, 3),
                colors["rock"],
                kind,
            ]
        )
    labels = {
        "mountain": ("Ridge approach", "High pass", "Valley lookout", "Base camp"),
        "rocky": ("Gravel crossing", "Rock shelf", "Survey point", "Base camp"),
        "forest": ("Trail entrance", "Forest clearing", "Creek overlook", "Base camp"),
    }[config["profile"]]
    return {
        "id": environment_id,
        "name": config["name"],
        "config": config,
        "description": DESCRIPTIONS[config["profile"]],
        "colors": colors,
        "bounds": list(WORLD_BOUNDS),
        "start": list(START),
        "objects": objects,
        "waypoints": [
            {"name": name, "x": x, "y": y}
            for name, (x, y) in zip(labels, ((16, -12), (16, 12), (-16, 12), START))
        ],
    }


def catalog():
    return [
        {
            "id": key,
            "name": value.name,
            "description": DESCRIPTIONS[key],
            "config": value.model_dump(),
        }
        for key, value in PRESETS.items()
    ]
