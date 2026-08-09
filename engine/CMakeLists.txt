cmake_minimum_required(VERSION 3.25)
project(stockfish_wasm)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(BUILD_DEBUG "Debug build: symbols, assertions, no optimisation" OFF)

add_executable(stockfish)

file(GLOB_RECURSE STOCKFISH_SOURCES stockfish/src/*.cpp)

list(REMOVE_ITEM STOCKFISH_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/stockfish/src/main.cpp")

set(WRAPPER_SOURCES wrapper.cpp StockfishWrapper.cpp)

target_sources(stockfish PRIVATE ${STOCKFISH_SOURCES} ${WRAPPER_SOURCES})

target_include_directories(
  stockfish
  PRIVATE stockfish/src
          stockfish/src/nnue
          stockfish/src/nnue/features
          stockfish/src/nnue/layers
          stockfish/src/syzygy
          stockfish/src/incbin
          stockfish_wrapper
)

if (BUILD_DEBUG)
  target_compile_definitions(stockfish PRIVATE DEBUG=1 _DEBUG=1)
  target_compile_options(stockfish PRIVATE -g)
else ()
  target_compile_definitions(stockfish PRIVATE NDEBUG)
  target_compile_options(stockfish PRIVATE -O3)
endif ()

include(emscripten.cmake)
