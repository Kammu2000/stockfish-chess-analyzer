// types
import { Opening } from "../types";

interface RawOpeningBook {
    openings: [eco: string, name: string][];
    positions: Record<string, number>;
}

export type OpeningLookup = (fen: string) => Opening | undefined;

let bookPromise: Promise<OpeningLookup> | null = null;

export const loadOpeningBook = (): Promise<OpeningLookup> => {
    bookPromise ??= import(/* webpackChunkName: "openings" */ "../constants/openings.json")
        .then((module) => {
            const book = module.default as unknown as RawOpeningBook;
            return (fen: string) => {
                const index = book.positions[fen.split(" ")[0]];
                if (index === undefined) return undefined;
                const [eco, name] = book.openings[index];
                return { eco, name };
            };
        })
        .catch((err) => {
            bookPromise = null;
            throw err;
        });
    return bookPromise;
};
