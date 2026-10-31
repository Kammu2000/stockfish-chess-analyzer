// libs
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// plugins
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtract from "mini-css-extract-plugin";
import CopyPlugin from "copy-webpack-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "public");

// Stockfish's compiled JS/WASM/NNUE-data files are the only public/ assets fetched by URL at
// runtime (engineService.ts) rather than statically imported, and the only ones large/volatile
// enough (rebuilt on every Stockfish/emsdk bump) to need cache-busting. Everything else in
// public/ (icons, sounds, _headers) is referenced by fixed string paths and stays unhashed.
const STOCKFISH_FILES = {
    rich: { base: "stockfish", js: "stockfish.js", wasm: "stockfish.wasm", data: "stockfish.data" },
    lite: {
        base: "stockfish-lite",
        js: "stockfish-lite.js",
        wasm: "stockfish-lite.wasm",
        data: "stockfish-lite.data",
    },
};

/**
 * Maps each Stockfish asset to the URL path engineService.ts should fetch it from. In
 * production, filenames are suffixed with a content hash so Netlify's immutable 1-year cache
 * headers are actually safe (a rebuilt binary gets a new URL instead of silently reusing a
 * stale cached one). In dev, webpack-dev-server serves public/ unmodified, so names are
 * left as-is. A variant that hasn't been built yet (public/stockfish-lite.wasm missing, say)
 * falls back to its plain name rather than failing the build.
 */
const buildStockfishAssetMap = (isDev) => {
    const assets = {};
    for (const [variant, files] of Object.entries(STOCKFISH_FILES)) {
        assets[variant] = {};
        for (const ext of ["js", "wasm", "data"]) {
            const fileName = files[ext];
            const filePath = path.join(publicDir, fileName);

            if (isDev || !fs.existsSync(filePath)) {
                assets[variant][ext] = `/${fileName}`;
                continue;
            }

            const hash = crypto
                .createHash("sha256")
                .update(fs.readFileSync(filePath))
                .digest("hex")
                .slice(0, 8);
            assets[variant][ext] = `/${files.base}.${hash}.${ext}`;
        }
    }
    return assets;
};

export default (env, argv) => {
    const isDev = argv.mode === "development";
    const stockfishAssets = buildStockfishAssetMap(isDev);

    // Copy each present Stockfish file to its (possibly hashed) output name; everything else in
    // public/ is copied unmodified via the catch-all pattern below.
    const stockfishCopyPatterns = Object.entries(STOCKFISH_FILES).flatMap(([variant, files]) =>
        ["js", "wasm", "data"]
            .filter((ext) => fs.existsSync(path.join(publicDir, files[ext])))
            .map((ext) => ({
                from: files[ext],
                to: stockfishAssets[variant][ext].slice(1), // drop leading "/"
                context: publicDir,
            }))
    );

    return {
        entry: "./src/main.tsx",

        output: {
            path: path.resolve(__dirname, "dist"),
            filename: "[name].[contenthash].js",
            chunkFilename: "[name].[contenthash].js",
            clean: true,
            publicPath: process.env.PUBLIC_PATH || "/",
        },

        resolve: {
            extensions: [".tsx", ".ts", ".js"],
        },

        module: {
            rules: [
                {
                    test: /\.[jt]sx?$/,
                    use: {
                        loader: "ts-loader",
                        options: {
                            transpileOnly: true,
                            compilerOptions: {
                                // ts-loader needs to emit JS even though tsconfig says noEmit
                                noEmit: false,
                                // node is safer than "bundler" for ts-loader
                                moduleResolution: "node",
                            },
                        },
                    },
                    exclude: /node_modules/,
                },

                // CSS → Tailwind → PostCSS
                {
                    test: /\.css$/,
                    use: [
                        isDev ? "style-loader" : MiniCssExtract.loader,
                        "css-loader",
                        "postcss-loader",
                    ],
                },
            ],
        },

        plugins: [
            // Inject compiled bundles into index.html (replaces Vite's module script tag)
            new HtmlWebpackPlugin({ template: "./index.html" }),

            // Extract CSS to a file in production
            ...(isDev ? [] : [new MiniCssExtract({ filename: "[name].[contenthash].css" })]),

            // Lets engineService.ts resolve the (possibly hashed) Stockfish asset URLs computed
            // above, without an extra runtime fetch of a manifest file.
            new webpack.DefinePlugin({
                __STOCKFISH_ASSETS__: JSON.stringify(stockfishAssets),
            }),

            new CopyPlugin({
                patterns: [
                    ...stockfishCopyPatterns,
                    {
                        from: "public",
                        to: ".",
                        noErrorOnMissing: true,
                        globOptions: {
                            ignore: [
                                "**/stockfish*.js",
                                "**/stockfish*.wasm",
                                "**/stockfish*.data",
                            ],
                        },
                    },
                ],
            }),
        ],

        devServer: {
            port: 3000,
            // Required for SharedArrayBuffer (Emscripten pthreads)
            headers: {
                "Cross-Origin-Opener-Policy": "same-origin",
                "Cross-Origin-Embedder-Policy": "require-corp",
            },
            // Serve stockfish.js / stockfish.wasm / stockfish.data from public/ in dev
            static: { directory: path.join(__dirname, "public") },
            historyApiFallback: true,
        },

        devtool: isDev ? "eval-source-map" : false,

        performance: {
            // Stockfish's NNUE/WASM assets (up to ~90MB for the full engine) and the generated
            // opening book are inherently large and fetched on demand, not part of the initial
            // page bundle -- webpack's default size-limit warnings for them are permanent, actionable-
            // free noise (and, via webpack-dev-server's overlay, block interacting with the page
            // during `npm start`/`npm run preview`). Still warn on genuine app-bundle bloat.
            assetFilter: (assetFilename) =>
                !/^stockfish(-lite)?\.[^./]*\.(js|wasm|data)$/.test(assetFilename) &&
                !/^openings\.[^./]*\.js$/.test(assetFilename),
        },
    };
};
