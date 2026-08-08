// libs
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// plugins
import HtmlWebpackPlugin from 'html-webpack-plugin'
import MiniCssExtract from 'mini-css-extract-plugin'
import CopyPlugin from 'copy-webpack-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default (env, argv) => {
  const isDev = argv.mode === 'development'

  return {
    entry: './src/main.tsx',

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].[contenthash].js',
      clean: true,
      publicPath: '/', // required so that the worker chunk URL resolves correctly at runtime
    },

    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },

    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              compilerOptions: {
                // ts-loader needs to emit JS even though tsconfig says noEmit
                noEmit: false,
                // node is safer than "bundler" for ts-loader
                moduleResolution: 'node',
              },
            },
          },
          exclude: /node_modules/,
        },

        // CSS → Tailwind → PostCSS
        {
          test: /\.css$/,
          use: [isDev ? 'style-loader' : MiniCssExtract.loader, 'css-loader', 'postcss-loader'],
        },
      ],
    },

    plugins: [
      // Inject compiled bundles into index.html (replaces Vite's module script tag)
      new HtmlWebpackPlugin({ template: './index.html' }),

      // Extract CSS to a file in production
      ...(isDev ? [] : [new MiniCssExtract({ filename: '[name].[contenthash].css' })]),

      // Copy public/ (stockfish.js, stockfish.wasm, stockfish.data) into dist/
      new CopyPlugin({
        patterns: [{ from: 'public', to: '.', noErrorOnMissing: true }],
      }),
    ],

    devServer: {
      port: 3000,
      // Required for SharedArrayBuffer (Emscripten pthreads)
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      // Serve stockfish.js / stockfish.wasm / stockfish.data from public/ in dev
      static: { directory: path.join(__dirname, 'public') },
      historyApiFallback: true,
    },

    devtool: isDev ? 'eval-source-map' : false,
  }
}
