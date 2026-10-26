export interface EngineAssets {
    wasmModule: WebAssembly.Module;
    dataBuffer: ArrayBuffer;
    glueScriptUrl: string;
}

export interface WorkerCommandPayload {
    id: number;
    message: string;
}

export interface WorkerCommandMessage {
    type: "message";
    payload: WorkerCommandPayload;
}

export interface WorkerAssetsMessage {
    type: "assets";
    payload: EngineAssets;
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
