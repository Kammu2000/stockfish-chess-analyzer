import { StockfishModuleInstance } from "./types";

declare function StockfishModule(
    options?: Record<string, unknown>
): Promise<StockfishModuleInstance>;
