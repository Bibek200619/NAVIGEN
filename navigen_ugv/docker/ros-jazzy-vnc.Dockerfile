FROM tiryoh/ros2-desktop-vnc:jazzy

USER root
ENV DEBIAN_FRONTEND=noninteractive

# Install the project's required dependencies
RUN apt-get update && apt-get install --no-install-recommends -y \
    liburdfdom-tools \
    python3-colcon-common-extensions \
    python3-pytest \
    ros-jazzy-ament-cmake-pytest \
    ros-jazzy-joint-state-publisher \
    ros-jazzy-joint-state-publisher-gui \
    ros-jazzy-navigation2 \
    ros-jazzy-nav2-bringup \
    ros-jazzy-robot-state-publisher \
    ros-jazzy-ros-gz \
    ros-jazzy-rviz2 \
    ros-jazzy-teleop-twist-keyboard \
    ros-jazzy-xacro \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
