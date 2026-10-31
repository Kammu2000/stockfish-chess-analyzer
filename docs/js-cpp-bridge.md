# JS ↔ C++ Bridge: How the Worker Talks to Stockfish

## The big picture

JavaScript and C++ live in completely separate memory worlds. JavaScript strings are UTF-16 objects on the JS heap. Stockfish's C++ functions expect a raw memory pointer — a number — pointing to a null-terminated UTF-8 byte sequence in **WASM linear memory** (a big flat `ArrayBuffer` that both JS and WASM can read). Everything in `stockfish.worker.ts` is about bridging that gap.

---

## Loading the module

```ts
importScripts(assets.glueScriptUrl);
```

`importScripts` is a Worker-only API — it synchronously fetches and executes a JS file inside the worker context. `stockfish.js` is the **Emscripten glue file** generated when compiling Stockfish C++ → WASM. By default it would fetch `stockfish.wasm` and the NNUE weights data file itself and set up WASM linear memory — but see the note below on why this app doesn't let it do that.

```ts
sfModule = await (self as any).StockfishModule({ locateFile: (f: string) => '/' + f });
```

`StockfishModule()` is async because it needs to fetch and compile the `.wasm` binary. `locateFile` is an Emscripten hook that tells the loader where to find asset files — here it prefixes every filename with `/` so `stockfish.wasm` is fetched from the root of the dev server. The returned `sfModule` is a live JS object with C functions exposed on it.

> **Why each worker doesn't fetch its own copy of the `.wasm`/NNUE data.**
> `engineService.ts` runs a *pool* of these workers (`ENGINE_POOL_SIZE`, up to
> 8). If each one independently let the glue code fetch `stockfish.wasm` +
> `stockfish.data` (~90MB), a single page load could trigger up to 8×
> redundant downloads of the same files — see
> `personal-docs/browser-caching-notes.md` for the full investigation. So
> instead, `engineService.ts` fetches both files **once** on the main
> thread, compiles the wasm once, and `postMessage`s the compiled
> `WebAssembly.Module` + raw NNUE bytes to each worker as an `"assets"`
> message. Each worker then passes those straight through to Emscripten's
> own `instantiateWasm`/`getPreloadedPackage` config hooks (both passed into
> the `StockfishModule({...})` call shown above), which makes the glue code
> skip its internal `fetch()` for both files entirely.
>
> The same `"assets"` message also carries a `glueScriptUrl` — a `Blob` URL
> for `stockfish.js` itself, fetched once on the main thread. Without it,
> `importScripts(assets.glueScriptUrl)` above would re-fetch the glue file
> per worker, **and** Emscripten's internal pthread sub-worker (spawned
> because the build sets `-sPTHREAD_POOL_SIZE=1`) would fetch it a second
> time per worker — 16 fetches for an 8-worker pool. Passing the same Blob
> URL as `mainScriptUrlOrBlob` makes that internal spawn reuse it too.

```ts
sfModule!._sf_init();
self.postMessage({ type: 'ready' });
```

`_sf_init()` is the C function in the wrapper (`stockfish_wrapper/`) that initialises Stockfish's internal state. Once done, the main thread is notified the engine is ready.

---

## Why we need to allocate a string

```ts
const allocateOnHeap = (mod: StockfishModuleInstance, str: string): number => {
  const len = mod.lengthBytesUTF8(str) + 1;  // +1 for the null terminator \0
  const ptr = mod._malloc(len);               // allocate bytes in WASM linear memory
  mod.stringToUTF8(str, ptr, len);            // copy the JS string into those bytes
  return ptr;                                 // return the address
};
```

The string being allocated is a **UCI command** — something like `"position fen rnbq... b KQkq - 0 1"` or `"go depth 15"`. This is what the main thread sends via `postMessage`.

The C++ function `_sf_cmd(ptr)` expects a `const char*` — a C-style pointer to a null-terminated byte array. It has no idea what a JavaScript string object is. So we must:

1. **Ask how many bytes** the UTF-8 encoding will need (`lengthBytesUTF8`)
2. **Allocate that many bytes** on the WASM heap (`_malloc`) — returns an integer address (e.g. `65792`) inside WASM's linear memory `ArrayBuffer`
3. **Write the JS string bytes** into those addresses (`stringToUTF8`)
4. **Hand the address number** to `_sf_cmd`

Think of it like: JS string → encode to bytes → write bytes at address 65792 → tell C++ "the string is at 65792".

---

## Why we free it in `callWithAllocatedHeapString`

```ts
const callWithAllocatedHeapString = (...): void => {
  const ptr = allocateOnHeap(mod, str);
  try {
    fn(ptr);         // _sf_cmd reads the bytes at ptr
  } finally {
    mod._free(ptr);  // always release the allocation
  }
};
```

`_malloc` / `_free` are C's manual memory management, exposed through WASM. There is no garbage collector here — if we don't call `_free`, that memory leaks inside the WASM heap forever. The `try/finally` guarantees `_free` runs even if `_sf_cmd` throws. The moment `_sf_cmd` returns, Stockfish has already read the bytes and finished processing the command — so it is safe to free immediately.

---

## Getting output back

```ts
const outputPtr = sfModule._sf_get_output();     // C++ returns a pointer
const output = sfModule.UTF8ToString(outputPtr); // Emscripten reads bytes at that address → JS string
```

`_sf_get_output()` is the C++ wrapper function that returns a `const char*` pointing to Stockfish's accumulated UCI output (all the `info depth...` lines + `bestmove ...`). Emscripten's `UTF8ToString` does the reverse of `stringToUTF8` — walks the bytes at that address until it hits `\0` and produces a JavaScript string. This pointer is not freed because the C++ side owns that buffer.

---

## C++ exceptions

The module is built with native Wasm exception handling (`-fwasm-exceptions`) and `-sEXCEPTION_STACK_TRACES=1`
(see `engine/emscripten.cmake`). Stockfish itself doesn't throw, but the C++ standard library can (e.g. `std::stoi`
on a malformed `setoption` value, `std::bad_alloc`). Nothing in C++ catches, so such an exception unwinds (running
destructors) out of the `cwrap` call into JS as a `WebAssembly.Exception` — not an `Error` — whose `.message` is
`[type, what()]` and whose `.stack` includes the Wasm frames. Release builds keep function names
(`--profiling-funcs`) so those frames are readable.

`toEngineError` in `stockfish.worker.ts` recognises it, logs the type, message and stack to the console (the stack
can't cross `postMessage`) and reports an `EngineFailed`/`EngineLoadFailed` `AppError`. `engineService` then fails
that worker until `retry()`.

An exception thrown on Stockfish's search thread (a separate pthread) isn't covered: it never reaches the worker's
`cwrap` call, which keeps waiting for the search to finish.

---

## Why this runs in a Worker

`_sf_cmd("go depth 15")` is **synchronous and blocking** on the C++ side — it does not return until Stockfish has finished the entire search (could be seconds). If this ran on the main thread it would freeze the browser UI completely. In a Worker it blocks the worker thread but the main thread (React UI) stays responsive and keeps rendering.

---

## Full data flow for one analysis

```
Main thread                       Worker thread (stockfish.worker.ts)
────────────────────────────────────────────────────────────────────────
postMessage("position fen ...")
                            →   onmessage fires
                                allocate "position fen ..." on WASM heap
                                _sf_cmd(ptr)  →  C++ sets the board
                                _free(ptr)
                                _sf_get_output() → empty (no search yet)
                                postMessage({ type: 'result', output: '' })
postMessage("go depth 15")
                            →   onmessage fires
                                allocate "go depth 15" on WASM heap
                                _sf_cmd(ptr)  →  C++ searches for seconds  ← blocks here
                                _free(ptr)
                                _sf_get_output() → "info depth 1 ... bestmove e2e4"
                                UTF8ToString(outputPtr) → JS string
                                postMessage({ type: 'result', output: "..." })
                            ←
parseEngineOutput("info depth 1...") → AnalysisResult
```
