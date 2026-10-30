export type ContractKind =
    | "panic"
    | "precondition"
    | "invariant"
    | "assert"
    | "unreachable"
    | "unimplemented";

// A bug: some code broke a contract. Never caught to recover from; the program can't be trusted
// to continue, so the violation handler takes over (see setViolationHandler).
export class ContractViolation extends Error {
    constructor(
        readonly kind: ContractKind,
        message: string
    ) {
        super(`${kind}: ${message}`);
        this.name = "ContractViolation";
    }
}

type ViolationHandler = (violation: ContractViolation) => void;

let onViolation: ViolationHandler = () => undefined;

// The program's response to a bug, e.g. a fatal-error screen. It runs before the violation is
// thrown, so no catch block up the stack can hide the bug.
export const setViolationHandler = (handler: ViolationHandler): void => {
    onViolation = handler;
};

const violate = (kind: ContractKind, message: string): never => {
    const violation = new ContractViolation(kind, message);
    console.error(violation);
    onViolation(violation);
    throw violation;
};

const DEBUG_CHECKS = process.env.NODE_ENV !== "production";

export const panic = (message: string): never => violate("panic", message);

export const unimplemented = (message: string): never => violate("unimplemented", message);

export const unreachable = (value: never): never =>
    violate("unreachable", `unexpected value ${JSON.stringify(value)}`);

export function precondition(condition: unknown, message: string): asserts condition {
    if (!condition) violate("precondition", message);
}

// What a pience of code (e.g. function) guarantees about its own state.
export function invariant(condition: unknown, message: string): asserts condition {
    if (!condition) violate("invariant", message);
}

// Development-only check of something that can't be false.
export function assert(condition: unknown, message: string): asserts condition {
    if (DEBUG_CHECKS && !condition) violate("assert", message);
}

// Development-only checks too costly for production. The check is a function so production
// builds don't evaluate it.

export const preconditionExpensive = (check: () => boolean, message: string): void => {
    if (DEBUG_CHECKS && !check()) violate("precondition", message);
};

export const invariantExpensive = (check: () => boolean, message: string): void => {
    if (DEBUG_CHECKS && !check()) violate("invariant", message);
};

export const assertExpensive = (check: () => boolean, message: string): void => {
    if (DEBUG_CHECKS && !check()) violate("assert", message);
};
