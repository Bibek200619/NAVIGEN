from glob import glob
import os

from setuptools import find_packages, setup

package_name = 'navigen_hardware'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml', 'README.md']),
        (os.path.join('share', package_name, 'config'), glob('config/*.yaml')),
        (os.path.join('share', package_name, 'launch'), glob('launch/*.launch.py')),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='NAVIGEN Team',
    maintainer_email='team@navigen.local',
    description='Hardware abstraction boundary for the NAVIGEN UGV.',
    license='MIT',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'esp32_bridge = navigen_hardware.esp32_bridge_node:main',
        ],
    },
)
