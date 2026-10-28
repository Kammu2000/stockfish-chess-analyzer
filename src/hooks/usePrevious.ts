// libs
import { useState } from "react";

// The value `value` had before it last changed (undefined until the first change). Tracked in
// state rather than a ref so it is safe to read during render.
export const usePrevious = <T>(value: T): T | undefined => {
    const [state, setState] = useState<{ current: T; previous: T | undefined }>({
        current: value,
        previous: undefined,
    });

    if (!Object.is(state.current, value)) {
        setState({ current: value, previous: state.current });
        return state.current;
    }

    return state.previous;
};
