import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        // registry-js is a win32-only optionalDependency (native prebuilt binary) — it's
        // dynamically imported in src/main/steam/discovery.ts and simply won't be present
        // in node_modules on non-Windows build machines. Externalizing it unconditionally
        // is safe: the dynamic import is already wrapped in a try/catch that treats a
        // missing/failed module as "not on Windows / registry unavailable".
        external: ['registry-js']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        output: {
          // Force CJS instead of the default ESM (.mjs) output. Sandboxed preload
          // scripts have historically had flaky ESM support across Electron versions/
          // platforms — CJS is the well-trodden path and removes a whole class of
          // "preload silently failed to run, contextBridge never fired" failures.
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
