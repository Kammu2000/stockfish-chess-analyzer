# JS ↔ C++ Bridge: How the Worker Talks to Stockfish

JS and C++ live in separate memory worlds: JS strings are UTF-16 objects on the JS heap, while
Stockfish's C functions take/return `const char*` — a pointer into **WASM linear memory** (a flat
`ArrayBuffer` shared by JS and WASM). `stockfish.worker.ts` bridges that gap for the wrapper's 5
exported C functions: `sf_init`, `sf_send_uci_message`, `sf_get_output`, `_malloc`, `_free`.

## Loading the module

```ts
importScripts(assets.glueScriptUrl);
const mod = await StockfishModule({ locateFile, mainScriptUrlOrBlob, instantiateWasm, getPreloadedPackage });
sf = { init: mod.cwrap("sf_init", null, []), ... };
sf.init();
```

`stockfish.js` is the Emscripten glue file generated when compiling Stockfish to WASM;
`importScripts` (Worker-only) loads it. By default the glue code would `fetch()` the `.wasm` and
NNUE data itself — but `engineService.ts` runs a pool of up to `ENGINE_POOL_SIZE` workers, and
letting each fetch independently would mean redundant ~90MB downloads. Instead `engineService.ts`
fetches the glue script, `.wasm`, and NNUE data **once** on the main thread and passes them to
each worker via an `"assets"` message; `instantiateWasm`/`getPreloadedPackage` make the glue code
use those instead of fetching. `mainScriptUrlOrBlob` similarly lets Emscripten's internal pthread
sub-worker (spawned because `-sPTHREAD_POOL_SIZE=1`) reuse the same glue script Blob URL instead
of re-fetching it.

`cwrap(name, returnType, argTypes)` wraps a raw C export into a JS function that marshals strings
automatically: passing `"string"` as an arg/return type makes Emscripten do the UTF-8
encode/`_malloc`/copy (or decode/read) for us, so the worker never touches `_malloc`/`_free`
directly — that's only exported for Emscripten's own internal use.

## Sending a command / getting output

```ts
sf.sendUCIMessage(message); // e.g. "position fen ..." or "go depth 15"
const output = sf.getOutput(); // all "info ..." lines + "bestmove ..." since the last call
```

`sf_send_uci_message` is **synchronous and blocking** — for `go depth N` it doesn't return until
the full search finishes (can take seconds). That's why this all runs in a Worker: blocking the
worker thread doesn't freeze the React UI.

## C++ exceptions

Built with native Wasm exception handling (`-fwasm-exceptions`, `-sEXCEPTION_STACK_TRACES=1`).
Stockfish itself doesn't throw, but the C++ stdlib can (e.g. `std::bad_alloc`). An uncaught
exception surfaces in JS as a `WebAssembly.Exception` (not an `Error`), whose `.message` is
`[type, what()]`. `toEngineError` in `stockfish.worker.ts` recognizes it, logs the type/message/
stack to the console (stack can't cross `postMessage`), and reports it as an `AppError`; the
worker then rejects pending/future commands until `engineService.retry()`. An exception on
Stockfish's search pthread isn't caught this way — it never returns to the worker's call.

## Data flow for one analysis

```
Main thread                              Worker thread
───────────────────────────────────────────────────────────────────────
postMessage("position fen ...")  →  sf.sendUCIMessage("position fen ...")
                                     postMessage({ type: "result", output: "" })
postMessage("go depth 15")       →  sf.sendUCIMessage("go depth 15")  ← blocks until search ends
                                     postMessage({ type: "result", output: "info ... bestmove e2e4" })
                                  ←  parseEngineOutput(output) → AnalysisResult
```
