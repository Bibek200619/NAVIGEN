"""Static contracts for the Phase 3 map, Nav2 configuration, launch, and RViz."""

import math
from pathlib import Path
from xml.etree import ElementTree

from ament_index_python.packages import get_package_share_directory
import yaml


def _share(package: str) -> Path:
    return Path(get_package_share_directory(package))


def _read_pgm(path: Path):
    tokens = []
    for line in path.read_text().splitlines():
        content = line.split('#', maxsplit=1)[0]
        tokens.extend(content.split())
    assert tokens.pop(0) == 'P2'
    width, height, max_value = map(int, tokens[:3])
    pixels = list(map(int, tokens[3:]))
    assert max_value == 255
    assert len(pixels) == width * height
    return width, height, [pixels[i * width:(i + 1) * width] for i in range(height)]


def test_required_nav2_plugins_limits_and_layers() -> None:
    config = yaml.safe_load((_share('navigen_navigation') / 'config' / 'nav2_sim.yaml').read_text())
    controller = config['controller_server']['ros__parameters']
    planner = config['planner_server']['ros__parameters']

    assert controller['FollowPath']['plugin'] == (
        'nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController'
    )
    assert controller['FollowPath']['desired_linear_vel'] <= 0.4
    assert controller['odom_topic'] == '/wheel/odom'
    assert config['bt_navigator']['ros__parameters']['default_server_timeout'] >= 1000
    assert planner['GridBased']['plugin'] == 'nav2_smac_planner::SmacPlanner2D'
    assert planner['GridBased']['allow_unknown'] is False

    expected_layers = ['static_layer', 'inflation_layer']
    for costmap_name in ('local_costmap', 'global_costmap'):
        costmap = config[costmap_name][costmap_name]['ros__parameters']
        assert costmap['plugins'] == expected_layers
        assert costmap['track_unknown_space'] is True
        assert 'obstacle_layer' not in costmap

    serialized = repr(config).lower()
    assert all(name not in serialized for name in ('navsat', 'nav_sat', 'nmea', 'amcl'))


def test_map_is_valid_and_aligned_with_gazebo_obstacles() -> None:
    navigation_share = _share('navigen_navigation')
    map_config = yaml.safe_load((navigation_share / 'maps' / 'navigen_outdoor.yaml').read_text())
    width, height, pixels = _read_pgm(navigation_share / 'maps' / map_config['image'])
    resolution = map_config['resolution']
    origin_x, origin_y, origin_yaw = map_config['origin']

    assert (width, height, resolution) == (48, 36, 0.25)
    assert origin_yaw == 0.0
    assert all(value == 0 for value in pixels[0] + pixels[-1])
    assert all(row[0] == 0 and row[-1] == 0 for row in pixels)

    world = ElementTree.parse(
        _share('navigen_bringup') / 'worlds' / 'navigen_outdoor.sdf'
    ).getroot().find("world[@name='navigen_outdoor']")
    expected_models = {
        'central_box_obstacle', 'low_box_obstacle', 'rock_cluster',
        'tree_left', 'tree_right', 'shallow_ramp',
    }
    models = {model.attrib['name']: model for model in world.findall('model')}
    assert expected_models <= models.keys()

    for model_name in expected_models:
        pose = [float(value) for value in models[model_name].findtext('pose').split()]
        column = math.floor((pose[0] - origin_x) / resolution)
        map_row = math.floor((pose[1] - origin_y) / resolution)
        image_row = height - 1 - map_row
        assert pixels[image_row][column] == 0, f'{model_name} center is not occupied'


def test_launch_behavior_tree_and_rviz_contract() -> None:
    share = _share('navigen_navigation')
    navigation_launch = (share / 'launch' / 'navigation.launch.py').read_text()
    sim_launch = (share / 'launch' / 'nav2_sim.launch.py').read_text()
    behavior_tree = ElementTree.parse(
        share / 'behavior_trees' / 'navigate_to_pose.xml'
    ).getroot()
    rviz = (share / 'rviz' / 'navigation.rviz').read_text()

    assert 'static_transform_publisher' in navigation_launch
    assert "'map', '--child-frame-id', 'odom'" in navigation_launch
    assert "'publish_map_to_odom'" in navigation_launch
    assert "'nav2_map_server'" in navigation_launch
    assert "'nav2_controller'" in navigation_launch
    assert "'nav2_planner'" in navigation_launch
    assert "'nav2_bt_navigator'" in navigation_launch
    assert "'nav2_lifecycle_manager'" in navigation_launch
    assert "'navigen_bringup'" in sim_launch
    assert 'TimerAction(period=3.0' in sim_launch

    tree_tags = {element.tag for element in behavior_tree.iter()}
    assert {'ComputePathToPose', 'FollowPath', 'ClearEntireCostmap'} <= tree_tags
    for topic in (
        '/map', '/global_costmap/costmap', '/local_costmap/costmap', '/plan',
        '/wheel/odom', '/goal_pose', '/camera/image_raw',
    ):
        assert topic in rviz
    assert 'nav2_rviz_plugins/GoalTool' in rviz
