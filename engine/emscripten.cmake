# Reads a newline-separated list file 
function(read_emscripten_config_list filename out_var)
  file(STRINGS "${CMAKE_CURRENT_LIST_DIR}/config/${filename}" raw_lines)
  set(result "")
  foreach(line IN LISTS raw_lines)
    string(STRIP "${line}" trimmed)
    if (trimmed STREQUAL "" OR trimmed MATCHES "^#")
      continue()
    endif ()
    list(APPEND result "${trimmed}")
  endforeach ()
  set(${out_var} "${result}" PARENT_SCOPE)
endfunction()

set_target_properties(stockfish PROPERTIES SUFFIX ".js")

# incbin uses AT&T assembly to embed binary data into .rodata sections, which
# wasm32 does not support. Disable it and let Emscripten preload the NNUE files
# into its virtual FS at link time instead.
target_compile_definitions(stockfish PRIVATE NNUE_EMBEDDING_OFF)

target_compile_options(stockfish PRIVATE -pthread -fwasm-exceptions)

read_emscripten_config_list(exported-functions.txt EXPORTED_FUNCTIONS_LIST)
list(TRANSFORM EXPORTED_FUNCTIONS_LIST REPLACE "^(.+)$" "'\\1'")
list(JOIN EXPORTED_FUNCTIONS_LIST "," EXPORTED_FUNCTIONS_JOINED)

read_emscripten_config_list(exported-runtime-methods.txt EXPORTED_RUNTIME_METHODS_LIST)
list(TRANSFORM EXPORTED_RUNTIME_METHODS_LIST REPLACE "^(.+)$" "'\\1'")
list(JOIN EXPORTED_RUNTIME_METHODS_LIST "," EXPORTED_RUNTIME_METHODS_JOINED)

read_emscripten_config_list(incoming-module-js-api.txt INCOMING_MODULE_JS_API_LIST)
list(JOIN INCOMING_MODULE_JS_API_LIST "," INCOMING_MODULE_JS_API_JOINED)

set(NNUE_SRC "${CMAKE_CURRENT_SOURCE_DIR}/stockfish/src")

if (BUILD_LITE)
  # Lite build: The BUILD_LITE define activates patched big-net dispatch (see scripts/build_cpp.py),
  # which makes evaluation always use the small net instead of falling back to the
  # (unavailable) big net.
  target_compile_definitions(stockfish PRIVATE BUILD_LITE)
  set(NNUE_PRELOAD_FLAGS "--preload-file=${NNUE_SRC}/nn-47fc8b7fff06.nnue@/nn-47fc8b7fff06.nnue")
  set(INITIAL_MEMORY 32MB)
else ()
  set(NNUE_PRELOAD_FLAGS
      "--preload-file=${NNUE_SRC}/nn-f68ec79f0fe3.nnue@/nn-f68ec79f0fe3.nnue"
      "--preload-file=${NNUE_SRC}/nn-47fc8b7fff06.nnue@/nn-47fc8b7fff06.nnue"
  )
  set(INITIAL_MEMORY 128MB)
endif ()

# link flags
target_link_options(
  stockfish
  PRIVATE
  -pthread
  -fwasm-exceptions
  -sEXCEPTION_STACK_TRACES=1
  -sWASM=1
  -sMODULARIZE=1
  -sEXPORT_NAME=StockfishModule
  -sALLOW_MEMORY_GROWTH=1
  -sINITIAL_MEMORY=${INITIAL_MEMORY}
  -sSTACK_SIZE=5MB
  # pthreads Stockfish always runs its search on its own std::thread even with
  # the "Threads" UCI option pinned at 1 (see engine.cpp)
  -sPTHREAD_POOL_SIZE=1
  -sALLOW_BLOCKING_ON_MAIN_THREAD=1
  -sINCOMING_MODULE_JS_API=${INCOMING_MODULE_JS_API_JOINED}
  -sEXPORTED_FUNCTIONS=[${EXPORTED_FUNCTIONS_JOINED}]
  -sEXPORTED_RUNTIME_METHODS=[${EXPORTED_RUNTIME_METHODS_JOINED}]
  -sENVIRONMENT=web,worker
  # NNUE files — preloaded into Emscripten virtual FS at link time
  ${NNUE_PRELOAD_FLAGS}
)

if (BUILD_DEBUG)
  target_link_options(
    stockfish
    PRIVATE
    -g
    -sASSERTIONS=1
    -sLLD_REPORT_UNDEFINED
  )
else ()
  # --profiling-funcs keeps function names so release stack traces are readable
  target_link_options(stockfish PRIVATE -O3 --profiling-funcs)
endif ()
