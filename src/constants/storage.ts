// All localStorage keys share this prefix so they don't collide with other apps on the same origin.
export const STORAGE_PREFIX = "chess-analyzer:";

export const STORAGE_KEYS = {
    pgnInput: "pgn-input",
    uploadTab: "upload-tab",
    importUsername: (source: string) => `import-username:${source}`,
    analysisSettings: "analysis-settings",
    boardSettings: "board-settings",
    settings: "settings",
} as const;
