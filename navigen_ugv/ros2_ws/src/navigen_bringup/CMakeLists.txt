cmake_minimum_required(VERSION 3.8)
project(navigen_bringup)

find_package(ament_cmake REQUIRED)

install(DIRECTORY launch config worlds
  DESTINATION share/${PROJECT_NAME})

install(FILES README.md
  DESTINATION share/${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_cmake_pytest REQUIRED)
  ament_add_pytest_test(test_simulation_assets test/test_simulation_assets.py
    TIMEOUT 60)

  find_package(launch_testing_ament_cmake REQUIRED)
  add_launch_test(test/test_simulation.launch.py TIMEOUT 120)
endif()

ament_package()
