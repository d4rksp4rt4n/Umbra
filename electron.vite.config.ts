import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// package.json is the single source of truth for the app version. It is read here (rather
// than imported, which would pull the whole manifest — dependency list included — into the
// renderer bundle) and substituted into `__APP_VERSION__` at build time, which is what
// src/shared/constants.ts exports as APP_VERSION. All three targets need the define: main
// and preload for the update check, renderer for the About dialog.
// Resolved against cwd, matching how the aliases below already resolve their paths —
// electron-vite always runs from the project root. Avoids __dirname, which is not
// available in an ESM config ("type": "module" in package.json).
const appVersion: string = JSON.parse(
  readFileSync(resolve('package.json'), 'utf8')
).version
const versionDefine = { __APP_VERSION__: JSON.stringify(appVersion) }

export default defineConfig({
  main: {
    define: versionDefine,
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
    define: versionDefine,
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
    define: versionDefine,
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      // Inline bundled assets (currently just the header banner, ~90KB) as data: URIs
      // instead of emitting separate files. In a packaged build the renderer document is
      // loaded over file://, where a `img-src 'self'` CSP does not reliably cover
      // sibling asset files — `data:` is already allowed, so inlining keeps images
      // working in production without loosening the policy.
      assetsInlineLimit: 256 * 1024
    },
    plugins: [react()]
  }
})
