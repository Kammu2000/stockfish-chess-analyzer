// types
import { WorkerIncomingMessage, StockfishModuleInstance, WrappedStockfish } from "./types";

const STOCKFISH_JS_PATH = "/stockfish.js";
// NNUE data (~90MB) can take a while to fetch on a slow connection.
const MODULE_LOAD_TIMEOUT_MS = 45000;

let sf: WrappedStockfish | null = null;

const wrapExports = (mod: StockfishModuleInstance): WrappedStockfish => ({
    init: mod.cwrap("sf_init", null, []) as () => void,
    sendUCIMessage: mod.cwrap("sf_send_uci_message", null, ["string"]) as (message: string) => void,
    getOutput: mod.cwrap("sf_get_output", "string", []) as () => string,
});

const checkThreadSupport = (): void => {
    if (!self.crossOriginIsolated) {
        throw new Error(
            "This app requires cross-origin isolation for Wasm threads. Check the server's " +
                "COOP/COEP headers."
        );
    }

    if (typeof SharedArrayBuffer === "undefined") {
        throw new Error("Shared memory is unavailable. Check your browser's security settings.");
    }

    try {
        new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    } catch (cause) {
        throw new Error(
            `This browser cannot initialize shared WebAssembly memory: ${String(cause)}`
        );
    }
};

// Settled by whichever of (module ready / load timeout / Emscripten abort) happens first.
const loadStockfishModule = (): Promise<StockfishModuleInstance> =>
    new Promise((resolve, reject) => {
        let settled = false;

        const settle = (run: () => void): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            run();
        };

        const timer = setTimeout(() => {
            settle(() =>
                reject(
                    new Error(
                        "Stockfish did not finish loading in time. Check your network connection and reload."
                    )
                )
            );
        }, MODULE_LOAD_TIMEOUT_MS);

        (self as any)
            .StockfishModule({
                locateFile: (f: string) => "/" + f,
                mainScriptUrlOrBlob: STOCKFISH_JS_PATH,
                onAbort: (reason: unknown) => {
                    settle(() =>
                        reject(new Error(`Stockfish aborted while loading: ${String(reason)}`))
                    );
                },
            })
            .then(
                (mod: StockfishModuleInstance) => settle(() => resolve(mod)),
                (err: unknown) =>
                    settle(() => reject(err instanceof Error ? err : new Error(String(err))))
            );
    });

const loadWasmModule = async (): Promise<void> => {
    try {
        checkThreadSupport();
        importScripts(STOCKFISH_JS_PATH);
        const mod = await loadStockfishModule();
        sf = wrapExports(mod);
        sf.init();
        self.postMessage({ type: "ready" });
    } catch (err) {
        self.postMessage({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
        });
    }
};

self.onmessage = (e: MessageEvent<WorkerIncomingMessage>): void => {
    const { type, id, message } = e.data;
    if (type !== "message" || !sf) return;

    sf.sendUCIMessage(message);

    const output = sf.getOutput();
    self.postMessage({ type: "result", id, output });
};

loadWasmModule();
