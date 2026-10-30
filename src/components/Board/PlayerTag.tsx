// libs
import { JSX } from "react";

// types
import { Color } from "../../types";

interface PlayerTagProps {
    color: Color;
    headers: Record<string, string>;
}

// PGN uses "?" (and sometimes "-") for unknown tag values.
const headerValue = (headers: Record<string, string>, key: string): string | undefined => {
    const value = headers[key]?.trim();
    return value && value !== "?" && value !== "-" ? value : undefined;
};

export const PlayerTag = ({ color, headers }: PlayerTagProps): JSX.Element => {
    const side = color === "w" ? "White" : "Black";
    const name = headerValue(headers, side) ?? side;
    const title = headerValue(headers, `${side}Title`);
    const rating = headerValue(headers, `${side}Elo`);

    return (
        <div className="flex items-center gap-2 min-w-0 h-6 text-sm">
            <span
                className={`w-4 h-4 shrink-0 rounded-sm border border-panel ${
                    color === "w" ? "bg-[#f0f0f0]" : "bg-[#1c1c1c]"
                }`}
                title={side}
            />
            {title && (
                <span className="px-1 rounded bg-red-700 text-[11px] font-bold text-white">
                    {title}
                </span>
            )}
            <span className="font-semibold text-white truncate">{name}</span>
            {rating && <span className="text-muted shrink-0">({rating})</span>}
        </div>
    );
};
