"""Static Phase 2 contracts for launch, bridge and outdoor-world assets."""

from pathlib import Path
from xml.etree import ElementTree

from ament_index_python.packages import get_package_share_directory
import yaml


def _share() -> Path:
    return Path(get_package_share_directory('navigen_bringup'))


def test_outdoor_world_has_runtime_systems_and_obstacle_variety() -> None:
    root = ElementTree.parse(_share() / 'worlds' / 'navigen_outdoor.sdf').getroot()
    world = root.find("world[@name='navigen_outdoor']")
    assert world is not None

    plugin_names = {plugin.attrib['name'] for plugin in world.findall('plugin')}
    assert {
        'gz::sim::systems::Physics',
        'gz::sim::systems::UserCommands',
        'gz::sim::systems::SceneBroadcaster',
        'gz::sim::systems::Sensors',
        'gz::sim::systems::Imu',
    } <= plugin_names

    model_names = {model.attrib['name'] for model in world.findall('model')}
    assert {'terrain', 'central_box_obstacle', 'rock_cluster', 'tree_left', 'shallow_ramp'} <= model_names
    assert 'gps' not in ElementTree.tostring(root, encoding='unicode').lower()


def test_bridge_contract_has_required_topics_and_safe_directions() -> None:
    bridge_entries = yaml.safe_load((_share() / 'config' / 'gz_bridge.yaml').read_text())
    entries = {entry['ros_topic_name']: entry for entry in bridge_entries}
    expected = {
        '/clock', '/cmd_vel', '/wheel/odom', '/tf', '/joint_states',
        '/camera/image_raw', '/camera/camera_info', '/imu/data',
    }
    assert expected == set(entries)
    assert entries['/cmd_vel']['direction'] == 'ROS_TO_GZ'
    assert all(
        entry['direction'] == 'GZ_TO_ROS'
        for topic, entry in entries.items()
        if topic != '/cmd_vel'
    )
    assert entries['/tf']['gz_topic_name'] == '/model/navigen/tf'
    assert entries['/camera/image_raw']['qos_profile'] == 'SENSOR_DATA'
    assert entries['/imu/data']['qos_profile'] == 'SENSOR_DATA'


def test_launch_and_assets_are_installed_and_navigation_has_no_gps_dependency() -> None:
    launch_text = (_share() / 'launch' / 'sim.launch.py').read_text()
    assert "'headless'" in launch_text
    assert "'rviz'" in launch_text
    assert "'spawn_x'" in launch_text
    assert "'spawn_yaw'" in launch_text
    assert "'software_rendering'" in launch_text
    assert 'robot_description' in launch_text
    assert 'navigen.urdf.xacro' in launch_text

    complete_contract = launch_text + (_share() / 'config' / 'gz_bridge.yaml').read_text()
    assert 'gps' not in complete_contract.lower()
