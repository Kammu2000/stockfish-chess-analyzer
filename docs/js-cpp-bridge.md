# JS ↔ C++ Bridge: How the Worker Talks to Stockfish

## The big picture

JavaScript and C++ live in completely separate memory worlds. JavaScript strings are UTF-16 objects on the JS heap. Stockfish's C++ functions expect a raw memory pointer — a number — pointing to a null-terminated UTF-8 byte sequence in **WASM linear memory** (a big flat `ArrayBuffer` that both JS and WASM can read). Everything in `stockfish.worker.ts` is about bridging that gap.

---

## Loading the module

```ts
importScripts(STOCKFISH_JS_PATH);
```

`importScripts` is a Worker-only API — it synchronously fetches and executes a JS file inside the worker context. `stockfish.js` is the **Emscripten glue file** generated when compiling Stockfish C++ → WASM. It does three things:
- Fetches `stockfish.wasm` (the actual binary)
- Sets up WASM linear memory
- Exposes a `StockfishModule()` function on `self` (the worker's global scope)

```ts
sfModule = await (self as any).StockfishModule({ locateFile: (f: string) => '/' + f });
```

`StockfishModule()` is async because it needs to fetch and compile the `.wasm` binary. `locateFile` is an Emscripten hook that tells the loader where to find asset files — here it prefixes every filename with `/` so `stockfish.wasm` is fetched from the root of the dev server. The returned `sfModule` is a live JS object with C functions exposed on it.

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
