from setuptools import find_packages, setup

package_name = 'navigen_safety'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml', 'README.md']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='NAVIGEN Team',
    maintainer_email='team@navigen.local',
    description='Safety arbitration boundary for the NAVIGEN UGV.',
    license='MIT',
    tests_require=['pytest'],
)
