import json
import subprocess
import sys
import unittest
from io import BytesIO
from math import isfinite
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from camera import render_camera
from engine import Simulation
from environments import PRESETS, START, TerrainConfig, build_environment, height_at
from navigation import ROVER_RADIUS, rectangles, segment_clear
from PIL import Image
from pydantic import ValidationError


class EnvironmentTests(unittest.TestCase):
    def test_all_presets_complete_with_obstacle_and_changing_elevation(self):
        for preset in PRESETS:
            with self.subTest(preset=preset):
                sim = Simulation()
                sim.select_environment(preset)
                sim.command("demo")
                statuses, heights, speeds = set(), [], []
                for _ in range(6000):
                    sim.step(0.05)
                    statuses.add(sim.status)
                    heights.append(sim.ground(sim.x, sim.y))
                    speeds.append(sim.linear_velocity)
                    self.assertTrue(
                        segment_clear(
                            (sim.x, sim.y),
                            (sim.x, sim.y),
                            rectangles(sim.objects, sim.obstacle, ROVER_RADIUS),
                            ROVER_RADIUS,
                        )
                    )
                    self.assertTrue(all(isfinite(v) for v in sim.terrain_pose()))
                    if sim.status == "completed":
                        break
                self.assertEqual(sim.status, "completed")
                self.assertIn("avoiding", statuses)
                self.assertNotIn("blocked", statuses)
                self.assertIsNotNone(sim.obstacle)
                self.assertGreater(max(heights) - min(heights), 0.5)
                self.assertGreater(max(speeds), 0.5)

    def test_manual_obstacle_during_guided_demo_does_not_break_ticker(self):
        sim = Simulation()
        sim.command("demo")
        sim.command("obstacle")
        for _ in range(6000):
            sim.step(0.05)
        self.assertEqual(sim.status, "completed")

    def test_switch_resets_pose_and_keeps_sessions_synchronized(self):
        sim = Simulation()
        sim.command("demo")
        for _ in range(200):
            sim.step(0.05)
        revision = sim.environment_revision
        sim.select_environment("forest")
        self.assertEqual(sim.status, "idle")
        self.assertEqual(sim.target, 0)
        self.assertEqual((sim.x, sim.y), START)
        self.assertEqual(sim.distance, 0)
        self.assertEqual(sim.environment_revision, revision + 1)
        self.assertEqual(sim.snapshot()["environment"]["id"], "forest")
        self.assertIsNone(sim.obstacle)
        self.assertFalse(sim.auto_demo)

    def test_custom_is_reproducible_and_survives_reset_and_switch(self):
        config = TerrainConfig(
            name="Field test", profile="forest", seed=123, density=18, weather="rain"
        ).model_dump()
        a = build_environment("custom", TerrainConfig(**config))
        b = build_environment("custom", TerrainConfig(**config))
        self.assertEqual(a, b)
        self.assertEqual(len(a["objects"]), 18)
        sim = Simulation()
        sim.select_environment("custom", config)
        sim.command("reset")
        self.assertEqual(sim.environment["config"], config)
        sim.select_environment("mountain")
        sim.select_environment("custom")
        self.assertEqual(sim.environment["config"], config)

    def test_invalid_config_does_not_mutate_scene(self):
        sim = Simulation()
        before = sim.environment_revision
        for patch in (
            {"relief": 50},
            {"density": 10000},
            {"grip": 0},
            {"seed": -1},
            {"name": "   "},
            {"roughness": float("nan")},
            {"script": "invalid"},
        ):
            with self.subTest(patch=patch), self.assertRaises(ValidationError):
                sim.select_environment("custom", patch)
        with self.assertRaises(ValueError):
            sim.select_environment("unknown")
        self.assertEqual(sim.environment_revision, before)
        self.assertEqual(sim.environment["id"], "mountain")

    def test_low_grip_and_rain_reduce_speed(self):
        def speed(grip, weather):
            sim = Simulation()
            sim.select_environment(
                "custom",
                TerrainConfig(
                    relief=0, roughness=0, grip=grip, weather=weather, density=0
                ).model_dump(),
            )
            sim.command("start")
            for _ in range(40):
                sim.step(0.05)
            return sim.linear_velocity

        self.assertGreater(speed(0.95, "clear"), speed(0.4, "clear"))
        self.assertGreater(speed(0.8, "clear"), speed(0.8, "rain"))

    def test_custom_extremes_have_traversable_patrols(self):
        for profile in PRESETS:
            sim = Simulation()
            sim.select_environment(
                "custom",
                TerrainConfig(
                    profile=profile,
                    relief=10,
                    roughness=1,
                    density=40,
                    grip=0.35,
                    weather="rain",
                    seed=918,
                ).model_dump(),
            )
            sim.command("demo")
            for _ in range(8000):
                sim.step(0.1)
                if sim.status == "completed":
                    break
            self.assertEqual(sim.status, "completed", profile)

    def test_camera_changes_with_terrain(self):
        sim = Simulation()
        images = []
        for preset in PRESETS:
            sim.select_environment(preset)
            frame = render_camera(sim.snapshot())
            self.assertEqual(Image.open(BytesIO(frame)).size, (640, 360))
            images.append(frame)
        self.assertEqual(len(set(images)), 3)

    def test_browser_and_backend_height_fields_match(self):
        configs = [value.model_dump() for value in PRESETS.values()]
        points = [(-16, -12), (0, 0), (8.25, 11.6), (-21.3, 17.8)]
        module = Path(__file__).resolve().parents[1] / "static/terrain.js"
        script = "import {heightAt} from " + json.dumps(module.as_uri()) + ";\n"
        script += (
            "const configs="
            + json.dumps(configs)
            + ",points="
            + json.dumps(points)
            + ";\n"
        )
        script += "console.log(JSON.stringify(configs.flatMap(c=>points.map(p=>heightAt(c,...p)))));"
        result = subprocess.run(
            ["node", "--input-type=module", "-e", script],
            check=True,
            capture_output=True,
            text=True,
        )
        actual = json.loads(result.stdout)
        expected = [height_at(c, *p) for c in configs for p in points]
        for a, b in zip(actual, expected):
            self.assertAlmostEqual(a, b, places=10)


if __name__ == "__main__":
    unittest.main()
