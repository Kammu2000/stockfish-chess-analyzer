// utils
import { precondition, setViolationHandler } from "../utils/errors/contract";
import { AppError, toAppError } from "../utils/errors/appError";

// types
import {
    WorkerIncomingMessage,
    StockfishModuleInstance,
    WrappedStockfish,
    EngineAssets,
} from "./types";
import { WorkerResult } from "../services/types";

let sf: WrappedStockfish | null = null;

// NNUE data (~90MB) can take a while to compile/instantiate on a slow device.
const MODULE_LOAD_TIMEOUT_MS = 45000;

type StockfishModuleFactory = (
    options: Record<string, unknown>
) => Promise<StockfishModuleInstance>;

const wrapExports = (mod: StockfishModuleInstance): WrappedStockfish => ({
    init: mod.cwrap("sf_init", null, []) as () => void,
    sendUCIMessage: mod.cwrap("sf_send_uci_message", null, ["string"]) as (message: string) => void,
    getOutput: mod.cwrap("sf_get_output", "string", []) as () => string,
});

const checkThreadSupport = (): void => {
    if (!self.crossOriginIsolated) {
        throw new AppError(
            "EngineUnsupported",
            "This app requires cross-origin isolation for Wasm threads. Check the server's " +
                "COOP/COEP headers."
        );
    }

    if (typeof SharedArrayBuffer === "undefined") {
        throw new AppError(
            "EngineUnsupported",
            "Shared memory is unavailable. Check your browser's security settings."
        );
    }

    try {
        new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    } catch (cause) {
        throw new AppError(
            "EngineUnsupported",
            `This browser cannot initialize shared WebAssembly memory: ${String(cause)}`,
            { cause }
        );
    }
};

// Settled by whichever of (module ready / load timeout / Emscripten abort) happens first.
const loadStockfishModule = (assets: EngineAssets): Promise<StockfishModuleInstance> =>
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
                    new AppError(
                        "EngineLoadFailed",
                        "Stockfish did not finish loading in time. Check your network connection and reload."
                    )
                )
            );
        }, MODULE_LOAD_TIMEOUT_MS);

        (self as unknown as { StockfishModule: StockfishModuleFactory })
            .StockfishModule({
                locateFile: (f: string) => "/" + f,
                mainScriptUrlOrBlob: assets.glueScriptUrl,
                instantiateWasm: (
                    info: WebAssembly.Imports,
                    receive: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void
                ) => {
                    WebAssembly.instantiate(assets.wasmModule, info)
                        .then((instance) => receive(instance, assets.wasmModule))
                        .catch((err) => settle(() => reject(err)));
                },
                getPreloadedPackage: () => assets.dataBuffer,
                onAbort: (reason: unknown) => {
                    settle(() =>
                        reject(
                            new AppError(
                                "EngineLoadFailed",
                                `Stockfish aborted while loading: ${String(reason)}`
                            )
                        )
                    );
                },
            })
            .then(
                (mod: StockfishModuleInstance) => settle(() => resolve(mod)),
                (err: unknown) => settle(() => reject(err))
            );
    });

const post = (msg: WorkerResult): void => self.postMessage(msg);

const postError = (err: AppError): void =>
    post({ type: "error", payload: { code: err.code, message: err.message } });

setViolationHandler((violation) =>
    post({ type: "panic", payload: { message: violation.message } })
);

const loadWasmModule = async (assets: EngineAssets): Promise<void> => {
    try {
        checkThreadSupport();
        importScripts(assets.glueScriptUrl);
        const mod = await loadStockfishModule(assets);
        sf = wrapExports(mod);
        sf.init();
        post({ type: "ready" });
    } catch (err) {
        postError(toAppError(err, "EngineLoadFailed"));
    }
};

// Every command gets exactly one reply: its output, or an error
const runCommand = (id: number, message: string): void => {
    precondition(sf, "commands are only sent after the worker reports ready");
    try {
        sf.sendUCIMessage(message);
        post({ type: "result", payload: { id, output: sf.getOutput() } });
    } catch (err) {
        postError(toAppError(err, "EngineFailed"));
    }
};

self.onmessage = (e: MessageEvent<WorkerIncomingMessage>): void => {
    const data = e.data;

    if (data.type === "assets") void loadWasmModule(data.payload);
    else runCommand(data.payload.id, data.payload.message);
};
