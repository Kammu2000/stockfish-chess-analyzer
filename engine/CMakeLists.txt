cmake_minimum_required(VERSION 3.25)
project(stockfish_wasm)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

option(BUILD_DEBUG "Debug build: symbols, assertions, no optimisation" OFF)
option(BUILD_LITE "Lite build: only embed/use the small NNUE net (smaller download, weaker eval)" OFF)
option(ENABLE_MEMORY_PROFILER "Link the emscripten-memory-profiler (repos/emscripten-memory-profiler submodule)" OFF)

if (ENABLE_MEMORY_PROFILER)
  add_subdirectory("${CMAKE_CURRENT_SOURCE_DIR}/../repos/emscripten-memory-profiler" emscripten-memory-profiler)
endif ()

add_executable(stockfish)

set(STOCKFISH_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../repos/stockfish")

file(GLOB_RECURSE STOCKFISH_SOURCES "${STOCKFISH_SRC_DIR}/src/*.cpp")

list(REMOVE_ITEM STOCKFISH_SOURCES
     "${STOCKFISH_SRC_DIR}/src/main.cpp"
)

# src/universal/* implements native x86 "universal binary" CPU-dispatch entry points
# (cpuid-based, non-portable). Irrelevant to a WASM build and won't compile under Emscripten.
file(GLOB UNIVERSAL_SOURCES "${STOCKFISH_SRC_DIR}/src/universal/*.cpp")
list(REMOVE_ITEM STOCKFISH_SOURCES ${UNIVERSAL_SOURCES})

set(WRAPPER_SOURCES stockfish_wrapper/wrapper.cpp
                    stockfish_wrapper/StockfishWrapper.cpp
)

target_sources(stockfish PRIVATE ${STOCKFISH_SOURCES} ${WRAPPER_SOURCES})

target_include_directories(
  stockfish
  PRIVATE "${STOCKFISH_SRC_DIR}/src"
          "${STOCKFISH_SRC_DIR}/src/nnue"
          "${STOCKFISH_SRC_DIR}/src/nnue/features"
          "${STOCKFISH_SRC_DIR}/src/nnue/layers"
          "${STOCKFISH_SRC_DIR}/src/syzygy"
          "${STOCKFISH_SRC_DIR}/src/incbin"
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

if (ENABLE_MEMORY_PROFILER)
  # FUNCTION_NAMES adds --profiling-funcs so allocation callstacks show C++ function names.
  emscripten_memory_profiler_enable(stockfish FUNCTION_NAMES)
endif ()
