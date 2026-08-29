cmake_minimum_required(VERSION 3.8)
project(navigen_description)

find_package(ament_cmake REQUIRED)

install(DIRECTORY urdf launch rviz config
  DESTINATION share/${PROJECT_NAME})

if(BUILD_TESTING)
  find_package(ament_cmake_pytest REQUIRED)
  ament_add_pytest_test(test_description test/test_description.py
    TIMEOUT 60)
endif()

ament_package()
