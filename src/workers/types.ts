/** The compiled wasm module, preloaded NNUE bytes, and a Blob URL for the Emscripten glue
 *  script — all fetched once on the main thread and handed to every pool worker (see
 *  personal-docs/browser-caching-notes.md). The Blob URL lets both the outer worker's own
 *  `importScripts` and Emscripten's internal pthread-sub-worker spawn reuse the same bytes
 *  instead of each independently re-fetching `stockfish.js` over the network. */
export interface EngineAssets {
    wasmModule: WebAssembly.Module;
    dataBuffer: ArrayBuffer;
    glueScriptUrl: string;
}

export interface WorkerCommandMessage {
    type: "message";
    id: number;
    message: string;
}

export interface WorkerAssetsMessage extends EngineAssets {
    type: "assets";
}

export type WorkerIncomingMessage = WorkerCommandMessage | WorkerAssetsMessage;

export interface StockfishModuleInstance {
    cwrap: (
        name: string,
        returnType: string | null,
        argTypes: string[]
    ) => (...args: unknown[]) => unknown;
}

export interface WrappedStockfish {
    init: () => void;
    sendUCIMessage: (message: string) => void;
    getOutput: () => string;
}
