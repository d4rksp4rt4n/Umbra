import { create } from 'zustand'

interface CacheStore {
  cachedFileNames: Set<string>
  refresh: () => Promise<void>
}

export const useCacheStore = create<CacheStore>((set) => ({
  cachedFileNames: new Set(),
  refresh: async () => {
    const files = await window.patcher.listCachedFiles()
    set({ cachedFileNames: new Set(files) })
  }
}))
