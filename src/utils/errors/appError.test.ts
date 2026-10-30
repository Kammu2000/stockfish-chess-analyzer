// libs
import { describe, expect, it, vi } from "vitest";

// utils
import { ContractViolation } from "./contract";
import { AppError, toAppError } from "./appError";

describe("toAppError", () => {
    it("keeps an AppError's own code", () => {
        const err = new AppError("UserNotFound", "No account");
        expect(toAppError(err, "Unknown")).toBe(err);
    });

    it("wraps a foreign error under the given code, keeping it as the cause", () => {
        const cause = new TypeError("Failed to fetch");
        const err = toAppError(cause, "NetworkError");
        expect(err).toMatchObject({ code: "NetworkError", message: "Failed to fetch", cause });
    });

    it("rethrows contract violations, which are bugs rather than failures", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const bug = new ContractViolation("invariant", "broken");
        expect(() => toAppError(bug, "Unknown")).toThrow(bug);
    });
});
