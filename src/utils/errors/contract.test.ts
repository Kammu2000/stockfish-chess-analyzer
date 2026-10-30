// libs
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// utils
import { ContractViolation, precondition, setViolationHandler, unreachable } from "./contract";

describe("contract checks", () => {
    const handler = vi.fn();

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        setViolationHandler(handler);
    });

    afterEach(() => {
        setViolationHandler(() => undefined);
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
        handler.mockReset();
    });

    it("does nothing when the condition holds", () => {
        expect(() => precondition(true, "holds")).not.toThrow();
        expect(handler).not.toHaveBeenCalled();
    });

    it("reports a violation to the handler before throwing it", () => {
        handler.mockImplementation((v: ContractViolation) => {
            expect(v.kind).toBe("precondition");
            expect(v.message).toBe("precondition: depth must be positive");
        });
        expect(() => precondition(false, "depth must be positive")).toThrow(ContractViolation);
        expect(handler).toHaveBeenCalledOnce();
    });

    it("names the unexpected value when an exhaustive switch falls through", () => {
        expect(() => unreachable("knight" as never)).toThrow('unexpected value "knight"');
    });

    it("skips development-only checks in production builds", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.resetModules();
        const prod = await import("./contract");
        const check = vi.fn(() => false);

        expect(() => prod.assert(false, "skipped")).not.toThrow();
        prod.preconditionExpensive(check, "skipped");
        expect(check).not.toHaveBeenCalled();
        expect(() => prod.precondition(false, "always checked")).toThrow();
    });
});
