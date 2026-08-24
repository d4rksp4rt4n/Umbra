/**
 * IPC surface for loading the game library. Renderer never touches Node/filesystem
 * directly — it calls these channels through the typed bridge exposed in src/preload.
 */
import { ipcMain } from 'electron'
import log from 'electron-log'
import { getSteamPath } from '@main/steam/discovery'
import { getInstalledGames } from '@main/steam/library'
import { downloadDatabase } from '@main/database/fetch'
import { loadDatabase, groupChanges } from '@main/database/normalize'
import { buildMatches, sortMatchesForDisplay } from '@main/database/match'
import { loadFavorites, saveFavorites } from '@main/config/favorites'
import { loadConfigs, migrateOldConfig } from '@main/config/perGameConfig'
import { setSteamPath } from '@main/steam/steamPathStore'
import { clearBoxArtCache } from '@main/steam/boxArt'
import type { GameMatch, LastAppliedMap, LibraryLoadResult } from '@shared/types'

function emptyResult(error: string): LibraryLoadResult {
  return {
    steamPath: null,
    installed: {},
    dbVersion: 'Unknown',
    dbUpdated: false,
    matches: [],
    groupedChanges: {},
    favorites: [],
    lastApplied: {},
    error
  }
}

/** Port of `App._has_update()`: true if the locally recorded last-applied file name
 *  isn't present in the DB entry's current file list, i.e. a newer patch exists. */
function hasUpdate(match: GameMatch, lastApplied: LastAppliedMap): boolean {
  const lastFile = lastApplied[match.appid]?.[match.gameName]?.file
  if (!lastFile) return false
  return !match.data.files.some((f) => f.name === lastFile)
}

/**
 * Runs the full startup pipeline once: locate Steam, scan installed games, fetch/refresh
 * the patch database, cross-reference the two, then layer in favorites and per-game
 * config (including the one-time old-config migration) so the result is display-ready.
 */
async function loadLibrary(): Promise<LibraryLoadResult> {
  const steamPath = await getSteamPath()
  setSteamPath(steamPath)
  if (!steamPath) {
    return emptyResult('Steam installation not found.')
  }

  clearBoxArtCache()
  const installed = await getInstalledGames(steamPath)
  const { updated, available } = await downloadDatabase()

  if (!available) {
    return {
      ...emptyResult(
        'Database download failed and no cached copy is available. Check your internet connection.'
      ),
      steamPath,
      installed
    }
  }

  const { version, entries, recentChanges } = await loadDatabase()
  const { matches } = buildMatches(installed, entries)

  const gameNameByAppid: Record<string, string> = {}
  for (const m of matches) gameNameByAppid[m.appid] = m.gameName

  await migrateOldConfig(installed)
  const lastApplied = await loadConfigs(installed, gameNameByAppid)
  const favorites = await loadFavorites()

  const orderedMatches = sortMatchesForDisplay(matches, favorites, (m) => hasUpdate(m, lastApplied))

  return {
    steamPath,
    installed,
    dbVersion: version,
    dbUpdated: updated,
    matches: orderedMatches,
    groupedChanges: groupChanges(recentChanges),
    favorites: [...favorites].sort(),
    lastApplied,
    error: null
  }
}

export function registerLibraryIpcHandlers(): void {
  ipcMain.handle('library:load', async () => {
    try {
      return await loadLibrary()
    } catch (err) {
      log.error('[ipc/library:load] Unexpected failure:', err)
      const message = err instanceof Error ? err.message : String(err)
      return emptyResult(message)
    }
  })

  // Port of App._toggle_favorite(): flips membership and persists immediately.
  // Returns the fresh sorted list rather than a delta so the renderer can just replace
  // its local state, no reducer logic needed on that side.
  ipcMain.handle('favorites:toggle', async (_event, appid: string) => {
    const favorites = await loadFavorites()
    if (favorites.has(appid)) {
      favorites.delete(appid)
    } else {
      favorites.add(appid)
    }
    await saveFavorites(favorites)
    return [...favorites].sort()
  })
}
