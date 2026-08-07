// libs
import { useMemo, useEffect, useState } from "react";

// services & utils & helpers
import { engineService } from "../../services/engineService";

// constants
import { ENGINE_STATUS_STYLES, Status } from "./constants";

export const EngineStatus = (): JSX.Element => {
    const [status, setStatus] = useState<Status>(Status.LOADING);

    useEffect(() => {
        engineService
            .ready()
            .then(() => setStatus(Status.READY))
            .catch(() => setStatus(Status.ERROR));
    }, []);

    const { dot, label } = useMemo(
        (): { dot: string; label: string } => ENGINE_STATUS_STYLES[status],
        [status]
    );

    return (
        <div className="flex items-center gap-2 text-xs text-muted">
            <div className={`w-2 h-2 rounded-full ${dot}`} />
            {label}
        </div>
    );
};
