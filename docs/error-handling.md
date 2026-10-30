# Error handling

Every way things go wrong is one of two kinds, and each has its own mechanism.

|             | Bug (contract violation)                                                                       | Failure (`AppError`)                                                 |
| ----------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Cause       | Our code broke a contract                                                                      | Something outside the program: bad input, network, browser           |
| Example     | `clamp(x, 10, 0)`, an unhandled worker message type                                            | Illegal PGN, Chess.com 404, no `SharedArrayBuffer`                   |
| Raised with | `precondition`, `invariant`, `assert`, `unreachable`, `panic` (`src/utils/errors/contract.ts`) | `throw new AppError(code, message)` (`src/utils/errors/appError.ts`) |
| Handled by  | Nobody; the app stops and shows the fatal screen                                               | A boundary that can restore a valid state and tell the user          |

## Contracts (`src/utils/errors/contract.ts`)

- `precondition(cond, msg)`: what the caller must guarantee. Checked at the top of a function.
- `invariant(cond, msg)`: what this code guarantees about its own state or data.
- `assert(cond, msg)`: development-only check of something that can't be false.
- `preconditionExpensive` / `invariantExpensive` / `assertExpensive(() => cond, msg)`:
  development-only checks too costly for production. They take a function so production
  doesn't evaluate it.
- `unreachable(value)`: the `default` of a switch over a union. `value` is typed `never`, so the
  compiler proves the switch exhaustive.
- `panic(msg)` / `unimplemented(msg)`: unconditional.

The checks are TypeScript assertion functions, so a passing `precondition(sf, ...)` also narrows
`sf` to non-null. TypeScript can't stringify the checked expression like a C++ macro, so every
check takes a message saying what was expected.

"Development-only" means `process.env.NODE_ENV !== "production"`; webpack replaces it at build
time.

### What a violation does

A failed check logs a `ContractViolation`, calls the handler installed with
`setViolationHandler`, then throws. The handler runs **before** the throw, so a catch block up the
stack can't hide the bug. It plays the role of `abort()`:

- **Main thread** (`src/main.tsx`): replaces the app with `FatalError` ("Something went wrong,
  reload"). `FatalErrorBoundary` does the same for exceptions thrown while rendering.
- **Stockfish worker**: posts `{type: "panic"}`, and `engineService` re-raises it with `panic` on
  the main thread.

Never catch a `ContractViolation` to carry on.

## Failures (`src/utils/errors/appError.ts`)

`AppError` carries an `ErrorCode` (a closed union) and a message **written for the user**. Throw
it where the failure is detected. Code that can't do anything about a failure just lets it
propagate. Most callers only show the message; branch on the code only when the reason changes
what to do (e.g. `GameImportPanel` doesn't retry `UserNotFound`).

At a boundary (a store action, a query, the worker's message handler), catch and classify with
`toAppError(err, fallbackCode)`:

- an `AppError` keeps its code;
- anything else (a library or browser error) is wrapped under `fallbackCode`, with the original
  as `cause`;
- a `ContractViolation` is rethrown: bugs aren't failures.

Show the message to the user; don't `console.error` an `AppError`, since it's expected. Log only
`Unknown` failures: they're library or browser errors that nobody translated.

Errors crossing `postMessage` lose their class, so the worker sends `{code, message}` and
`engineService` rebuilds the `AppError`.

## Choosing

- The caller passed something it shouldn't have → `precondition`.
- This module's own state or bundled data is inconsistent → `invariant`.
- The input came from outside (user, network, engine output, files) → validate it and throw an
  `AppError`. Outside input never violates a contract.
- An optional, best-effort resource failed (opening book, sounds, `localStorage`) → recover locally
  with a fallback (`NO_OPENINGS`) and `console.warn`.
