import { create } from 'zustand'
import { useLibraryStore } from './libraryStore'
import type { AppSettings, OwnedImportResult } from '@shared/types'

interface SettingsStore {
  settings: AppSettings
  loaded: boolean
  settingsOpen: boolean
  cacheDirPath: string
  /** Outcome of the most recent owned-games import, shown inline in Settings until the
   *  next import attempt. Null before the first one. */
  ownedImport: OwnedImportResult | null
  importing: boolean
  load: () => Promise<void>
  setBetaAutoInstall: (enabled: boolean) => Promise<void>
  setAutoInstallAfterDownload: (enabled: boolean) => Promise<void>
  setShowUninstalled: (enabled: boolean) => Promise<void>
  importOwnedGames: () => Promise<void>
  clearOwnedGames: () => Promise<void>
  setViewMode: (mode: 'list' | 'grid') => Promise<void>
  chooseCacheDir: () => Promise<void>
  resetCacheDir: () => Promise<void>
  refreshCacheDirPath: () => Promise<void>
  openSettings: () => void
  closeSettings: () => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {
    betaAutoInstall: false,
    cacheDirOverride: null,
    autoInstallAfterDownload: false,
    viewMode: 'list',
    showUninstalled: false
  },
  loaded: false,
  settingsOpen: false,
  cacheDirPath: '',
  ownedImport: null,
  importing: false,

  load: async () => {
    const settings = await window.patcher.getSettings()
    set({ settings, loaded: true })
    void get().refreshCacheDirPath()
  },

  setBetaAutoInstall: async (enabled) => {
    const settings = await window.patcher.setSettings({ betaAutoInstall: enabled })
    set({ settings })
  },

  setAutoInstallAfterDownload: async (enabled) => {
    const settings = await window.patcher.setSettings({ autoInstallAfterDownload: enabled })
    set({ settings })
  },

  // Unlike the other toggles this one changes which games are in the list, so it has to
  // rebuild the library afterwards — the match set is computed in the main process.
  setShowUninstalled: async (enabled) => {
    const settings = await window.patcher.setSettings({ showUninstalled: enabled })
    set({ settings })
    await useLibraryStore.getState().reload()
  },

  importOwnedGames: async () => {
    set({ importing: true })
    try {
      const result = await window.patcher.importOwnedGames()
      // A cancelled file picker comes back as { ok: false, error: null } — that's not a
      // failure worth reporting, so leave the previous result on screen untouched.
      const cancelled = !result.ok && result.error === null
      if (!cancelled) set({ ownedImport: result })
      if (result.ok) await useLibraryStore.getState().reload()
    } finally {
      set({ importing: false })
    }
  },

  clearOwnedGames: async () => {
    await window.patcher.clearOwnedGames()
    set({ ownedImport: null })
    await useLibraryStore.getState().reload()
  },

  setViewMode: async (mode) => {
    // Optimistic — this fires on every list/grid click, no need to wait on the round trip.
    set((s) => ({ settings: { ...s.settings, viewMode: mode } }))
    await window.patcher.setSettings({ viewMode: mode })
  },

  chooseCacheDir: async () => {
    const settings = await window.patcher.chooseCacheDir()
    set({ settings })
    void get().refreshCacheDirPath()
  },

  resetCacheDir: async () => {
    const settings = await window.patcher.resetCacheDir()
    set({ settings })
    void get().refreshCacheDirPath()
  },

  refreshCacheDirPath: async () => {
    const cacheDirPath = await window.patcher.getCacheDir()
    set({ cacheDirPath })
  },

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false })
}))
