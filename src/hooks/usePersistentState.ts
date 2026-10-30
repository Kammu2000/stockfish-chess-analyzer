// libs
import { Dispatch, SetStateAction, useEffect, useState } from "react";

// utils
import { loadValue, saveValue } from "../utils/storage";

export function usePersistentState<T>(
    key: string,
    initial: T,
    isValid: (value: unknown) => value is T = (_v): _v is T => true
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        const stored = loadValue<unknown>(key, initial);
        return isValid(stored) ? stored : initial;
    });

    useEffect(() => {
        saveValue(key, value);
    }, [key, value]);

    return [value, setValue];
}
