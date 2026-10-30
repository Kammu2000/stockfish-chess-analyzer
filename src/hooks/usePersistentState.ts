// libs
import { Dispatch, SetStateAction, useEffect, useState } from "react";

// utils
import { loadValue, saveValue } from "../utils/storage";

export function usePersistentState<T>(
    key: string,
    initial: T,
    isValid: (value: unknown) => value is T
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        const stored = loadValue(key);
        return isValid(stored) ? stored : initial;
    });

    useEffect(() => {
        saveValue(key, value);
    }, [key, value]);

    return [value, setValue];
}
