/**
 * Central UI state for the library view. Splits into two concerns:
 *   - server-derived data (matches, installed, db status) set once from `library:load`
 *   - pure UI state (view mode, search text, selected game)
 */
import { create } from 'zustand'
import type {
  GameMatch,
  InstalledGamesMap,
  LastAppliedMap,
  LastPatchRecord,
  LibraryLoadResult,
  OwnedSource
} from '@shared/types'

export type ViewMode = 'list' | 'grid'

interface LibraryStore {
  // --- server data ---
  loading: boolean
  error: string | null
  steamPath: string | null
  installed: InstalledGamesMap
  dbVersion: string
  dbUpdated: boolean
  matches: GameMatch[]
  groupedChanges: Record<string, string[]>
  favorites: Set<string>
  lastApplied: LastAppliedMap
  /** Imported owned-games list metadata, surfaced in Settings. */
  ownedCount: number
  ownedSyncedAt: string | null
  ownedSource: OwnedSource | null
  /** How many listed games are owned but not installed. */
  uninstalledCount: number

  // --- UI state ---
  viewMode: ViewMode
  search: string
  selectedAppid: string | null

  // --- actions ---
  setLibrary: (result: LibraryLoadResult) => void
  setLoading: (loading: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setSearch: (search: string) => void
  selectGame: (appid: string | null) => void
  toggleFavorite: (appid: string) => Promise<void>
  /** Reflects a just-completed Beta apply into state immediately, so "Last install
   *  changes" and the "Applied"/update badges update without needing a full app restart
   *  (the on-disk patcher_config.json this mirrors is already updated by the main process
   *  at this point — this just catches the in-memory store up to match it). */
  updateLastApplied: (appid: string, gameName: string, record: LastPatchRecord) => void
  /** Re-runs the whole library pipeline in place. Used after importing or clearing the
   *  owned-games list, and after toggling show-uninstalled, so the list reflects the
   *  change without an app restart. */
  reload: () => Promise<void>
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  loading: true,
  error: null,
  steamPath: null,
  installed: {},
  dbVersion: 'Unknown',
  dbUpdated: false,
  matches: [],
  groupedChanges: {},
  favorites: new Set(),
  lastApplied: {},
  ownedCount: 0,
  ownedSyncedAt: null,
  ownedSource: null,
  uninstalledCount: 0,

  viewMode: 'list',
  search: '',
  selectedAppid: null,

  setLibrary: (result) =>
    set({
      loading: false,
      error: result.error,
      steamPath: result.steamPath,
      installed: result.installed,
      dbVersion: result.dbVersion,
      dbUpdated: result.dbUpdated,
      matches: result.matches,
      groupedChanges: result.groupedChanges,
      favorites: new Set(result.favorites),
      lastApplied: result.lastApplied,
      ownedCount: result.ownedCount,
      ownedSyncedAt: result.ownedSyncedAt,
      ownedSource: result.ownedSource,
      uninstalledCount: result.uninstalledCount,
      // Auto-select the first game once data lands.
      selectedAppid: result.matches[0]?.appid ?? null
    }),

  setLoading: (loading) => set({ loading }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSearch: (search) => set({ search }),
  selectGame: (selectedAppid) => set({ selectedAppid }),

  toggleFavorite: async (appid) => {
    const updated = await window.patcher.toggleFavorite(appid)
    set({ favorites: new Set(updated) })
  },

  updateLastApplied: (appid, gameName, record) =>
    set((s) => ({
      lastApplied: {
        ...s.lastApplied,
        [appid]: { ...s.lastApplied[appid], [gameName]: record }
      }
    })),

  reload: async () => {
    // Deliberately not flipping `loading` — that swaps the whole window for a full-screen
    // spinner, which is far too heavy for a settings toggle. The list just updates when
    // the result lands.
    const previous = get().selectedAppid
    const result = await window.patcher.loadLibrary()
    set({
      loading: false,
      error: result.error,
      steamPath: result.steamPath,
      installed: result.installed,
      dbVersion: result.dbVersion,
      dbUpdated: result.dbUpdated,
      matches: result.matches,
      groupedChanges: result.groupedChanges,
      favorites: new Set(result.favorites),
      lastApplied: result.lastApplied,
      ownedCount: result.ownedCount,
      ownedSyncedAt: result.ownedSyncedAt,
      ownedSource: result.ownedSource,
      uninstalledCount: result.uninstalledCount,
      // Keep the user where they were if that game survived the refresh; otherwise fall
      // back to the top of the new list.
      selectedAppid: result.matches.some((m) => m.appid === previous)
        ? previous
        : (result.matches[0]?.appid ?? null)
    })
  }
}))

/** True if this match's recorded last-applied file isn't in the DB's current file list. */
export function hasUpdate(match: GameMatch, lastApplied: LastAppliedMap): boolean {
  const lastFile = lastApplied[match.appid]?.[match.gameName]?.file
  if (!lastFile) return false
  return !match.data.files.some((f) => f.name === lastFile)
}
