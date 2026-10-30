// constants
import { STORAGE_PREFIX } from "../constants/storage";

// localStorage can throw (private mode, quota exceeded, disabled storage) — persistence is a
// convenience, so failures fall back to defaults instead of breaking the app.

export function loadValue<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
        return fallback;
    }
}

export function saveValue<T>(key: string, value: T): void {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
        // ignore — see note above
    }
}
