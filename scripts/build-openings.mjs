// Generates src/constants/openings.json:
//   { openings: [[eco, name], ...], positions: { "<FEN piece placement>": <index into openings> } }
//
// Source: lichess-org/chess-openings (CC0 / public domain), https://github.com/lichess-org/chess-openings
// Usage: npm run build-openings

// libs
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const BASE_URL = "https://raw.githubusercontent.com/lichess-org/chess-openings/master";
const FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"];
const OUTPUT = fileURLToPath(new URL("../src/constants/openings.json", import.meta.url));

const fetchTsv = async (file) => {
    const res = await fetch(`${BASE_URL}/${file}`);
    if (!res.ok) throw new Error(`Failed to download ${file}: HTTP ${res.status}`);
    return res.text();
};

const parseFile = async (file) => {
    const lines = (await fetchTsv(file)).trim().split("\n");
    const header = lines.shift().split("\t");
    const col = (name) => {
        const i = header.indexOf(name);
        if (i < 0) throw new Error(`${file}: missing "${name}" column`);
        return i;
    };
    const [ecoCol, nameCol, pgnCol] = [col("eco"), col("name"), col("pgn")];

    return lines.map((line) => {
        const cells = line.split("\t");
        const chess = new Chess();
        chess.loadPgn(cells[pgnCol]);
        return { eco: cells[ecoCol], name: cells[nameCol], moves: chess.history() };
    });
};

const placementAfter = (chess) => chess.fen().split(" ")[0];

const main = async () => {
    const lines = (await Promise.all(FILES.map(parseFile))).flat();

    // Pass 1 — named positions: the final position of each line. Several lines can reach the same
    // position (transpositions): keep the most specific (longest move list); ties keep the first.
    const named = new Map(); // placement -> { eco, name, plies }
    for (const { eco, name, moves } of lines) {
        const chess = new Chess();
        for (const san of moves) chess.move(san);

        const placement = placementAfter(chess);
        const existing = named.get(placement);
        if (!existing || moves.length > existing.plies) {
            named.set(placement, { eco, name, plies: moves.length });
        }
    }

    // Pass 2 — every intermediate position on a book line is also theory, even if the dataset
    // gives it no name of its own; label it with the nearest named position earlier on that line.
    const book = new Map(); // placement -> { eco, name }
    for (const [placement, { eco, name }] of named) book.set(placement, { eco, name });

    for (const { moves } of lines) {
        const chess = new Chess();
        let current = null;
        for (const san of moves) {
            chess.move(san);
            const placement = placementAfter(chess);
            const hit = named.get(placement);
            if (hit) current = { eco: hit.eco, name: hit.name };
            else if (current && !book.has(placement)) book.set(placement, current);
        }
    }

    // Compact output: each distinct opening is stored once in `openings`, and `positions` maps a
    // placement to its index (intermediate positions share names, so this roughly halves the size).
    const openings = [];
    const indexOf = new Map(); // "eco\tname" -> index
    const positions = {};
    for (const placement of [...book.keys()].sort()) {
        const { eco, name } = book.get(placement);
        const key = `${eco}\t${name}`;
        if (!indexOf.has(key)) {
            indexOf.set(key, openings.length);
            openings.push([eco, name]);
        }
        positions[placement] = indexOf.get(key);
    }

    await writeFile(OUTPUT, JSON.stringify({ openings, positions }) + "\n");
    console.log(
        `Wrote ${book.size} positions (${named.size} named, from ${lines.length} lines) to ${OUTPUT}`
    );
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
