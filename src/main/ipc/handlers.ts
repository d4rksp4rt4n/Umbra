/**
 * IPC surface for loading the game library. Renderer never touches Node/filesystem
 * directly — it calls these channels through the typed bridge exposed in src/preload.
 */
import { ipcMain, dialog } from 'electron'
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
import {
  clearOwnedLibrary,
  importOwnedFromFile,
  loadOwnedLibrary,
  saveOwnedLibrary
} from '@main/steam/ownedGames'
import { getSettings } from '@main/config/settings'
import type {
  GameMatch,
  LastAppliedMap,
  LibraryLoadResult,
  OwnedImportResult
} from '@shared/types'

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
    ownedCount: 0,
    ownedSyncedAt: null,
    ownedSource: null,
    uninstalledCount: 0,
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
 * the patch database, cross-reference the two (plus the imported owned-games list, when
 * the show-uninstalled toggle is on), then layer in favorites and per-game config
 * (including the one-time old-config migration) so the result is display-ready.
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

  // The owned-games list is read on every load so an import (or a clear) takes effect on
  // the next refresh without a restart. It's only *applied* when the toggle is on.
  const ownedLibrary = await loadOwnedLibrary()
  const { showUninstalled } = getSettings()
  const { matches } = buildMatches(installed, entries, {
    owned: new Set(ownedLibrary.appids),
    includeUninstalled: showUninstalled
  })

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
    ownedCount: ownedLibrary.appids.length,
    ownedSyncedAt: ownedLibrary.syncedAt,
    ownedSource: ownedLibrary.source,
    uninstalledCount: orderedMatches.filter((m) => !m.installed).length,
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

  // Opens a file picker for a Steam library export and replaces the stored owned-games
  // list with what it contains. Deliberately a whole-file replace rather than a merge:
  // a re-import is how the user drops games they no longer own.
  ipcMain.handle('owned:import', async (): Promise<OwnedImportResult> => {
    const empty = { parsed: 0, syncedAt: null, source: null }
    try {
      const picked = await dialog.showOpenDialog({
        title: 'Choose a saved Steam library export',
        properties: ['openFile'],
        filters: [
          { name: 'Steam library export', extensions: ['htm', 'html', 'json', 'txt'] },
          { name: 'All files', extensions: ['*'] }
        ]
      })
      if (picked.canceled || !picked.filePaths[0]) {
        return { ok: false, ...empty, error: null }
      }

      const { appids, source } = await importOwnedFromFile(picked.filePaths[0])
      const syncedAt = new Date().toISOString()
      await saveOwnedLibrary({ appids, syncedAt, source })
      log.info(`[ipc/owned:import] Imported ${appids.length} owned appids from ${source}`)
      return { ok: true, parsed: appids.length, syncedAt, source, error: null }
    } catch (err) {
      // Deliberately does not log the file path: an export lives wherever the user put
      // it, and that path can carry their account name.
      const message = err instanceof Error ? err.message : String(err)
      log.warn(`[ipc/owned:import] Import failed: ${message}`)
      return { ok: false, ...empty, error: message }
    }
  })

  ipcMain.handle('owned:clear', async (): Promise<void> => {
    await clearOwnedLibrary()
    log.info('[ipc/owned:clear] Owned-games list cleared')
  })
}
