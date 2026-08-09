// types
import { WorkerIncomingMessage, StockfishModuleInstance, WrappedStockfish } from "./types";

const STOCKFISH_JS_PATH = "/stockfish.js";

let sf: WrappedStockfish | null = null;

const wrapExports = (mod: StockfishModuleInstance): WrappedStockfish => ({
    init: mod.cwrap("sf_init", null, []) as () => void,
    sendUCIMessage: mod.cwrap("sf_send_uci_message", null, ["string"]) as (message: string) => void,
    getOutput: mod.cwrap("sf_get_output", "string", []) as () => string,
});

const loadWasmModule = async (): Promise<void> => {
    try {
        importScripts(STOCKFISH_JS_PATH);
        const mod = await (self as any).StockfishModule({
            locateFile: (f: string) => "/" + f,
            mainScriptUrlOrBlob: STOCKFISH_JS_PATH,
        });
        sf = wrapExports(mod);
        sf.init();
        self.postMessage({ type: "ready" });
    } catch (err) {
        self.postMessage({ type: "error", message: String(err) });
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
