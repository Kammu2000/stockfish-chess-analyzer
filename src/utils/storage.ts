// constants
import { STORAGE_PREFIX } from "../constants/storage";

// localStorage can throw (private mode, quota exceeded, disabled storage) — persistence is a
// convenience, so failures fall back to defaults instead of breaking the app.

// Returns the stored value as untrusted `unknown` (undefined if missing or unreadable): it may
// come from an older app version or be edited by hand, so callers must validate it.
export function loadValue(key: string): unknown {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        return raw === null ? undefined : JSON.parse(raw);
    } catch {
        return undefined;
    }
}

export function saveValue<T>(key: string, value: T): void {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
        // ignore — see note above
    }
}
