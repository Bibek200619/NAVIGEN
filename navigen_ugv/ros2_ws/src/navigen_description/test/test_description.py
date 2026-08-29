"""Phase 1 contract tests for the generated robot description."""

from pathlib import Path
from xml.etree import ElementTree

from ament_index_python.packages import get_package_share_directory
import xacro


EXPECTED_LINKS = {
    'base_footprint',
    'base_link',
    'front_left_wheel_link',
    'front_right_wheel_link',
    'rear_left_wheel_link',
    'rear_right_wheel_link',
    'camera_link',
    'camera_optical_frame',
    'imu_link',
    'ultrasonic_left_link',
    'ultrasonic_right_link',
}


def _generated_robot(use_sim: bool) -> ElementTree.Element:
    package_share = Path(get_package_share_directory('navigen_description'))
    xacro_path = package_share / 'urdf' / 'navigen.urdf.xacro'
    document = xacro.process_file(
        str(xacro_path),
        mappings={'use_sim': 'true' if use_sim else 'false'},
    )
    return ElementTree.fromstring(document.toxml())


def test_real_description_has_complete_static_tree_and_no_gps() -> None:
    robot = _generated_robot(use_sim=False)
    links = {link.attrib['name'] for link in robot.findall('link')}
    assert EXPECTED_LINKS <= links

    child_links = {
        joint.find('child').attrib['link']
        for joint in robot.findall('joint')
    }
    assert child_links == links - {'base_footprint'}
    assert all(joint.find('parent') is not None for joint in robot.findall('joint'))
    assert 'gps' not in ElementTree.tostring(robot, encoding='unicode').lower()
    assert robot.findall('.//plugin') == []


def test_four_wheel_joints_are_continuous_and_use_one_axis() -> None:
    robot = _generated_robot(use_sim=False)
    wheel_joints = {
        joint.attrib['name']: joint
        for joint in robot.findall('joint')
        if joint.attrib['name'].endswith('_wheel_joint')
    }
    assert len(wheel_joints) == 4
    assert all(joint.attrib['type'] == 'continuous' for joint in wheel_joints.values())
    assert all(joint.find('axis').attrib['xyz'] == '0 1 0' for joint in wheel_joints.values())


def test_sim_description_contains_required_gazebo_systems_and_sensors() -> None:
    robot = _generated_robot(use_sim=True)
    plugin_names = {plugin.attrib['name'] for plugin in robot.findall('.//plugin')}
    sensor_types = {sensor.attrib['type'] for sensor in robot.findall('.//sensor')}

    assert 'gz::sim::systems::DiffDrive' in plugin_names
    assert 'gz::sim::systems::JointStatePublisher' in plugin_names
    assert {'camera', 'imu'} <= sensor_types
