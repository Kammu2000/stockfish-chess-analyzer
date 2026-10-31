// Injected by webpack.config.js (DefinePlugin) at build time: the URL path for each Stockfish
// asset, content-hashed in production so CDN/browser caching stays safe across rebuilds, and
// left as plain /stockfish*.{js,wasm,data} paths in dev (served unmodified from public/).
declare const __STOCKFISH_ASSETS__: Record<
    "lite" | "rich",
    { js: string; wasm: string; data: string }
>;
