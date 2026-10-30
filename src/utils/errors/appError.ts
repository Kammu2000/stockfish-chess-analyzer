// utils
import { ContractViolation } from "./contract";

export type ErrorCode =
    | "InvalidPgn"
    | "EmptyGame"
    | "EngineUnsupported"
    | "EngineLoadFailed"
    | "EngineFailed"
    | "EngineRestarted"
    | "NetworkError"
    | "UserNotFound"
    | "UnexpectedResponse"
    | "MissingEvaluation"
    | "Unknown";

// An expected failure: an operation couldn't deliver its result because of something outside the
// program's control (bad input, the network, the browser). The message is written for the user.
export class AppError extends Error {
    constructor(
        readonly code: ErrorCode,
        message: string,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = "AppError";
    }
}

export const isAppError = (err: unknown, code?: ErrorCode): err is AppError =>
    err instanceof AppError && (code === undefined || err.code === code);

// For catch blocks: classifies a caught value as an AppError, keeping its code if it already is
// one. Contract violations are bugs, not failures, so they're rethrown untouched.
export const toAppError = (err: unknown, code: ErrorCode): AppError => {
    if (err instanceof ContractViolation) throw err;
    if (err instanceof AppError) return err;
    const message = err instanceof Error ? err.message : String(err);
    return new AppError(code, message, { cause: err });
};
