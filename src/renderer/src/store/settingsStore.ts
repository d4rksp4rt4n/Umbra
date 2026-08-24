import { create } from 'zustand'
import type { AppSettings } from '@shared/types'

interface SettingsStore {
  settings: AppSettings
  loaded: boolean
  settingsOpen: boolean
  cacheDirPath: string
  load: () => Promise<void>
  setBetaAutoInstall: (enabled: boolean) => Promise<void>
  setAutoInstallAfterDownload: (enabled: boolean) => Promise<void>
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
    viewMode: 'list'
  },
  loaded: false,
  settingsOpen: false,
  cacheDirPath: '',

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
