// Node has no localStorage/window; give persisted Zustand stores an in-memory one so they don't warn.
class MemoryStorage implements Storage {
    private items = new Map<string, string>();

    get length(): number {
        return this.items.size;
    }

    clear(): void {
        this.items.clear();
    }

    getItem(key: string): string | null {
        return this.items.get(key) ?? null;
    }

    key(index: number): string | null {
        return [...this.items.keys()][index] ?? null;
    }

    removeItem(key: string): void {
        this.items.delete(key);
    }

    setItem(key: string, value: string): void {
        this.items.set(key, String(value));
    }
}

const storage = new MemoryStorage();

// defineProperty (not assignment) so it also replaces Node's own getter-only `localStorage`, which
// exists when Node runs with --experimental-webstorage (or by default in newer versions).
Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
});

// Zustand's persist middleware reads `window.localStorage`, so expose a minimal `window` too
// (just the storage — not a DOM).
Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
    writable: true,
});
