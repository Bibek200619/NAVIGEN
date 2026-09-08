import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from io import BytesIO

from camera import render_camera
from engine import Simulation
from environments import START
from navigation import ROVER_RADIUS, rectangles, segment_clear
from PIL import Image


class DemoTests(unittest.TestCase):
    def test_inspection_reaches_all_checkpoints(self):
        sim = Simulation()
        sim.command("start")
        for _ in range(6000):
            sim.step(0.05)
        self.assertEqual(sim.status, "completed")
        self.assertEqual(sim.target, 4)
        self.assertEqual(sim.snapshot()["progress_pct"], 100)
        self.assertAlmostEqual(sim.x, START[0])
        self.assertAlmostEqual(sim.y, START[1])
        self.assertGreater(sim.distance, 50)
        sim.command("estop")
        self.assertEqual(sim.snapshot()["progress_pct"], 100)

    def test_guided_demo_turns_and_completes(self):
        sim = Simulation()
        sim.command("demo")
        statuses = set()
        for _ in range(6000):
            sim.step(0.05)
            statuses.add(sim.status)
        self.assertIn("avoiding", statuses)
        self.assertNotIn("blocked", statuses)
        self.assertEqual(sim.status, "completed")
        self.assertIsNotNone(sim.obstacle)

    def test_pause_and_estop_stop_motion(self):
        sim = Simulation()
        sim.command("start")
        for _ in range(20):
            sim.step(0.05)
        sim.command("pause")
        before = (sim.x, sim.y)
        for _ in range(20):
            sim.step(0.05)
        self.assertEqual(before, (sim.x, sim.y))
        self.assertEqual(sim.linear_velocity, 0)
        sim.command("start")
        sim.command("estop")
        for _ in range(20):
            sim.step(0.05)
        self.assertEqual(before, (sim.x, sim.y))
        with self.assertRaises(ValueError):
            sim.command("start")
        sim.command("clear_obstacle")
        self.assertEqual(sim.status, "emergency_stop")
        sim.command("reset")
        self.assertFalse(sim.estop)

    def assert_clear(self, sim):
        self.assertTrue(
            segment_clear(
                (sim.x, sim.y),
                (sim.x, sim.y),
                rectangles(sim.objects, sim.obstacle, ROVER_RADIUS),
                ROVER_RADIUS,
            ),
            f"Collision at {(sim.x, sim.y)}",
        )

    def test_detours_on_each_side_of_the_field(self):
        for checkpoint in range(4):
            with self.subTest(checkpoint=checkpoint):
                sim = Simulation()
                sim.command("start")
                for _ in range(6000):
                    sim.step(0.05)
                    if sim.target == checkpoint and sim.linear_velocity > 0.5:
                        break
                sim.command("obstacle")
                self.assertEqual(sim.status, "avoiding")
                obstacle = sim.obstacle.copy()
                for _ in range(6000):
                    sim.step(0.05)
                    self.assert_clear(sim)
                    self.assertNotEqual(sim.status, "blocked")
                    if sim.status == "completed":
                        break
                self.assertEqual(sim.status, "completed")
                self.assertEqual(sim.obstacle, obstacle)

    def test_pause_resume_and_clear_during_detour(self):
        sim = Simulation()
        sim.command("start")
        sim.command("obstacle")
        for _ in range(10):
            sim.step(0.05)
        self.assertEqual(sim.status, "avoiding")
        sim.command("pause")
        pose = (sim.x, sim.y, sim.yaw)
        for _ in range(20):
            sim.step(0.05)
        self.assertEqual((sim.x, sim.y, sim.yaw), pose)
        sim.command("start")
        self.assertEqual(sim.status, "avoiding")
        sim.command("clear_obstacle")
        self.assertEqual(sim.status, "running")
        self.assertFalse(sim.snapshot()["avoidance_path"])
        for _ in range(6000):
            sim.step(0.05)
        self.assertEqual(sim.status, "completed")

    def test_estop_latches_during_detour(self):
        sim = Simulation()
        sim.command("start")
        sim.command("obstacle")
        sim.step(0.1)
        sim.command("estop")
        pose = (sim.x, sim.y, sim.yaw)
        sim.command("clear_obstacle")
        for _ in range(20):
            sim.step(0.1)
        self.assertEqual((sim.x, sim.y, sim.yaw), pose)
        self.assertEqual(sim.status, "emergency_stop")
        with self.assertRaises(ValueError):
            sim.command("start")

    def test_unreachable_checkpoint_waits_without_collision(self):
        sim = Simulation()
        sim.command("start")
        sim.obstacle = {
            "x": sim.waypoints[0]["x"],
            "y": sim.waypoints[0]["y"],
            "radius": 0.55,
        }
        sim.plan_route()
        self.assertEqual(sim.status, "blocked")
        for _ in range(20):
            sim.step(0.05)
        self.assertEqual((sim.x, sim.y), START)
        sim.command("clear_obstacle")
        self.assertEqual(sim.status, "running")

    def test_camera_tracks_pose(self):
        sim = Simulation()
        first = render_camera(sim.snapshot())
        self.assertEqual(Image.open(BytesIO(first)).size, (640, 360))
        sim.command("start")
        for _ in range(50):
            sim.step(0.05)
        self.assertNotEqual(first, render_camera(sim.snapshot()))

    def test_unknown_command_rejected(self):
        with self.assertRaises(ValueError):
            Simulation().command("drive_motor")


if __name__ == "__main__":
    unittest.main()
