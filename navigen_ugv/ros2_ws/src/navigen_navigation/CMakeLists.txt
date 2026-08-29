cmake_minimum_required(VERSION 3.8)
project(navigen_navigation)

find_package(ament_cmake REQUIRED)

install(DIRECTORY behavior_trees config launch maps rviz
  DESTINATION share/${PROJECT_NAME})

install(FILES README.md
  DESTINATION share/${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_cmake_pytest REQUIRED)
  ament_add_pytest_test(test_navigation_config test/test_navigation_config.py
    TIMEOUT 60)

  find_package(launch_testing_ament_cmake REQUIRED)
  add_launch_test(test/test_navigation.launch.py TIMEOUT 180)
endif()

ament_package()
