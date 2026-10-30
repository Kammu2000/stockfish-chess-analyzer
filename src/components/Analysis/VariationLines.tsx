// libs
import { JSX, MouseEvent } from "react";

// components
import { MoveAnnotation } from "./MoveAnnotation";

// hooks
import { useGameStore } from "../../store/gameStore";

// utils
import { Variations } from "../../utils/variations";

// types
import { VariationNode } from "../../types";

const moveNumberLabel = (node: VariationNode, force: boolean): string | null => {
    const n = Math.floor(node.move.ply / 2) + 1;
    if (node.move.ply % 2 === 0) return `${n}.`;
    return force ? `${n}...` : null;
};

const VariationToken = ({
    node,
    showNumber,
}: {
    node: VariationNode;
    showNumber: boolean;
}): JSX.Element => {
    const active = useGameStore((s) => s.currentVarId === node.id);
    const goToVariation = useGameStore((s) => s.goToVariation);
    const deleteVariation = useGameStore((s) => s.deleteVariation);
    const label = moveNumberLabel(node, showNumber);

    const onContextMenu = (e: MouseEvent): void => {
        e.preventDefault();
        deleteVariation(node.id);
    };

    return (
        <>
            {label && <span className="text-muted ml-1 select-none">{label}</span>}
            <button
                id={`var-${node.id}`}
                onClick={() => goToVariation(node.id)}
                onContextMenu={onContextMenu}
                title="Right-click to delete from here"
                className={[
                    "inline-flex items-center gap-0.5 rounded px-1 transition-colors",
                    active ? "bg-accent/20 text-white" : "text-gray-300 hover:bg-surface",
                ].join(" ")}
            >
                {node.move.san}
                {node.result && (
                    <MoveAnnotation classification={node.result.classification} compact />
                )}
                {node.status === "pending" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
                )}
                {node.status === "error" && <span className="text-red-400">?</span>}
            </button>
        </>
    );
};

// Renders the line starting at `id` (following children[0]); `alternatives` are siblings of
// `id`, shown in parentheses right after it, like PGN.
const renderLine = (
    variations: Variations,
    id: string,
    alternatives: string[],
    forceNumber: boolean
): JSX.Element[] => {
    const out: JSX.Element[] = [];
    let cur: string | undefined = id;
    let alts = alternatives;
    let showNumber = forceNumber;

    while (cur && variations[cur]) {
        const node: VariationNode = variations[cur];
        out.push(<VariationToken key={cur} node={node} showNumber={showNumber} />);
        showNumber = false;

        for (const alt of alts) {
            out.push(
                <span key={`alt-${alt}`} className="text-muted">
                    {" ("}
                    {renderLine(variations, alt, [], true)}
                    {") "}
                </span>
            );
            showNumber = true;
        }

        const [next, ...rest]: string[] = node.children;
        cur = next;
        alts = rest;
    }
    return out;
};

export const VariationLines = ({ roots }: { roots: VariationNode[] }): JSX.Element => {
    const variations = useGameStore((s) => s.variations);
    const deleteVariation = useGameStore((s) => s.deleteVariation);

    return (
        <div className="flex flex-col gap-1 py-1">
            {roots.map((root) => (
                <div
                    key={root.id}
                    className="group relative ml-7 pl-2 pr-6 border-l-2 border-accent/40 text-xs leading-6"
                >
                    {renderLine(variations, root.id, [], true)}
                    <button
                        onClick={() => deleteVariation(root.id)}
                        className="absolute right-1 top-0 hidden group-hover:block text-muted hover:text-red-400"
                        title="Delete variation"
                        aria-label="Delete variation"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
};
