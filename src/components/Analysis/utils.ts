// types
import { MoveNode } from "../../types";

interface MovePair {
    white?: MoveNode;
    black?: MoveNode;
}

export const getMovePairs = (moves: MoveNode[]): MovePair[] => {
    const pairs: MovePair[] = [];

    for (let i = 0; i < moves.length; i += 2) {
        pairs.push({ white: moves[i], black: moves[i + 1] });
    }

    return pairs;
};
