/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#1a1a2e',
        surface: '#16213e',
        panel:   '#0f3460',
        accent:  '#e94560',
        muted:   '#8892b0',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'eval-bar': 'eval-bar 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
}
