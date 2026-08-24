import { create } from 'zustand'

interface UiStore {
  aboutOpen: boolean
  openAbout: () => void
  closeAbout: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  aboutOpen: false,
  openAbout: () => set({ aboutOpen: true }),
  closeAbout: () => set({ aboutOpen: false })
}))
