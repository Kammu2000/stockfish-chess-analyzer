# Output as .js (Emscripten glue), the .wasm is emitted alongside it
set_target_properties(stockfish PROPERTIES SUFFIX ".js")

# incbin uses AT&T assembly to embed binary data into .rodata sections,
# which wasm32 does not support. Disable it and let Emscripten preload the
# NNUE files into its virtual FS at link time instead.
target_compile_definitions(stockfish PRIVATE NNUE_EMBEDDING_OFF)

target_compile_options(stockfish PRIVATE -pthread)

set(NNUE_SRC "${CMAKE_CURRENT_SOURCE_DIR}/stockfish/src")

# link flags
target_link_options(stockfish PRIVATE
    -pthread
    -sWASM=1
    -sMODULARIZE=1
    -sEXPORT_NAME=StockfishModule
    -sALLOW_MEMORY_GROWTH=1

    # Memory enough for both NNUE networks + TT + search stack
    -sINITIAL_MEMORY=268435456   # 256 MB
    -sSTACK_SIZE=8388608          # 8 MB
    -sMAXIMUM_MEMORY=1073741824   # 1 GB

    # pthreads
    # Stockfish always runs its search on its own std::thread even with the
    # "Threads" UCI option pinned at 1 (see engine.cpp)
    -sPTHREAD_POOL_SIZE=1
    -sALLOW_BLOCKING_ON_MAIN_THREAD=1

    # exported symbols
    -sEXPORTED_FUNCTIONS=['_sf_init','_sf_send_uci_message','_sf_get_output','_malloc','_free']
    -sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','lengthBytesUTF8','stringToUTF8']
    -sENVIRONMENT=web,worker

    # NNUE files — preloaded into Emscripten virtual FS at link time
    "--preload-file=${NNUE_SRC}/nn-f68ec79f0fe3.nnue@/nn-f68ec79f0fe3.nnue"
    "--preload-file=${NNUE_SRC}/nn-47fc8b7fff06.nnue@/nn-47fc8b7fff06.nnue"
)

if(BUILD_DEBUG)
  target_link_options(stockfish PRIVATE
        -g
        -sASSERTIONS=1
        -sLLD_REPORT_UNDEFINED
    )
else()
  target_link_options(stockfish PRIVATE -O3)
endif()
