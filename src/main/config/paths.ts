/**
 * App data paths. Electron apps can't assume a writable folder next to the binary
 * (Program Files is read-only, macOS bundles are signed/read-only), so everything lives
 * under Electron's per-OS userData directory.
 *
 * This module is intentionally side-effect-light: `app.getPath` is only called lazily,
 * so it's safe to import before `app.whenReady()`.
 */
import { app } from 'electron'
import { join } from 'node:path'

export function getDataDir(): string {
  return join(app.getPath('userData'), 'data')
}

export function getDbPath(): string {
  return join(getDataDir(), 'patches_database.json')
}

export function getDbEtagPath(): string {
  return join(getDataDir(), 'patches_database.etag')
}

export function getFavoritesPath(): string {
  return join(getDataDir(), 'favorites.json')
}

export function getCacheDir(): string {
  return join(getDataDir(), 'cache')
}

/** Resolves the effective cache dir, honoring a settings override if the user set one. */
export function resolveCacheDir(override: string | null): string {
  return override && override.trim().length > 0 ? override : getCacheDir()
}

export function getLogPath(): string {
  return join(getDataDir(), 'patcher.log')
}

/** patcher_config.json is written per-game, inside the game's own install directory,
 *  so it survives even if the app's userData is wiped. */
export const CONFIG_FILENAME = 'patcher_config.json'
