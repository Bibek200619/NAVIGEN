"""Shortest visible detours around known geometry, with vehicle clearance."""

from heapq import heappop, heappush
from math import hypot

from environments import WORLD_BOUNDS

# Covers the entire rover at any heading, including its wheels.
ROVER_RADIUS = 1.0
PLANNING_MARGIN = 0.24


def rectangles(objects, obstacle, clearance):
    bounds = [
        (
            x - w / 2 - clearance,
            y - d / 2 - clearance,
            x + w / 2 + clearance,
            y + d / 2 + clearance,
        )
        for x, y, w, d, *_ in objects
    ]
    if obstacle:
        x, y, r = obstacle["x"], obstacle["y"], obstacle["radius"] + clearance
        bounds.append((x - r, y - r, x + r, y + r))
    return bounds


def segment_clear(a, b, bounds, clearance, world_bounds=WORLD_BOUNDS):
    if any(
        abs(x) >= world_bounds[0] - clearance or abs(y) >= world_bounds[1] - clearance
        for x, y in (a, b)
    ):
        return False
    for left, bottom, right, top in bounds:
        low, high = 0.0, 1.0
        for origin, delta, minimum, maximum in (
            (a[0], b[0] - a[0], left, right),
            (a[1], b[1] - a[1], bottom, top),
        ):
            if abs(delta) < 1e-10:
                if not minimum <= origin <= maximum:
                    low, high = 1.0, 0.0
                    break
            else:
                enter, leave = sorted(
                    ((minimum - origin) / delta, (maximum - origin) / delta)
                )
                low, high = max(low, enter), min(high, leave)
        if low <= high:
            return False
    return True


def plan_path(start, goal, objects, obstacle):
    """Visibility graph and Dijkstra; return steering points, or None if blocked."""
    clearance = ROVER_RADIUS + PLANNING_MARGIN
    bounds = rectangles(objects, obstacle, clearance)
    if segment_clear(start, goal, bounds, clearance):
        return [goal]
    nodes = [start, goal]
    for left, bottom, right, top in bounds:
        for point in (
            (left - 0.02, bottom - 0.02),
            (left - 0.02, top + 0.02),
            (right + 0.02, bottom - 0.02),
            (right + 0.02, top + 0.02),
        ):
            if segment_clear(point, point, bounds, clearance):
                nodes.append(point)
    costs, previous, queue = {0: 0.0}, {}, [(0.0, 0)]
    while queue:
        cost, index = heappop(queue)
        if cost != costs[index]:
            continue
        if index == 1:
            path = []
            while index:
                path.append(nodes[index])
                index = previous[index]
            return list(reversed(path))
        for neighbor, point in enumerate(nodes):
            distance = hypot(point[0] - nodes[index][0], point[1] - nodes[index][1])
            next_cost = cost + distance
            if next_cost < costs.get(neighbor, float("inf")) and segment_clear(
                nodes[index], point, bounds, clearance
            ):
                costs[neighbor], previous[neighbor] = next_cost, index
                heappush(queue, (next_cost, neighbor))
    return None
