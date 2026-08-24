/** @type {import('tailwindcss').Config} */
// Colors mirror src/shared/constants.ts STEAM_PALETTE. If you change one, change both —
// this file can't import TS at config-load time without extra tooling, so it's manual.
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-darkest': '#171a21',
        'bg-dark': '#1b2838',
        'bg-card': '#2a475e',
        'bg-hover': '#3d6b8e',
        'bg-input': '#1e2a3a',
        accent: '#66c0f4',
        'accent-dim': '#417a9b',
        text: '#c6d4df',
        'text-dim': '#8f98a0',
        'text-bright': '#ffffff',
        danger: '#b52f2f',
        'danger-hover': '#d44040',
        success: '#00ff88',
        'success-dim': '#4CAF50',
        warn: '#e67e22',
        link: '#64B5F6',
        viewable: '#66bb6a',
        'viewable-hover': '#90CAF9',
        'fav-gold': '#f5c542'
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
