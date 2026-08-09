export interface WorkerIncomingMessage {
    type: string;
    id: number;
    message: string;
}

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
