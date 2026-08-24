import { create } from 'zustand'
import type { PatchApplyResponse } from '@shared/types'

interface PatchStore {
  applying: boolean
  /** Index (into match.data.files) of the row currently being downloaded/applied. */
  activeIndex: number | null
  status: string
  percent: number
  speed: number
  result: PatchApplyResponse | null
  /** Index awaiting confirmation in the ConfirmApplyDialog, or null if none open. */
  confirmTarget: number | null

  resetForGame: () => void
  setApplying: (applying: boolean, index: number | null) => void
  setProgress: (status: string, percent: number, speed: number) => void
  setResult: (result: PatchApplyResponse | null) => void
  openConfirm: (index: number) => void
  closeConfirm: () => void
}

export const usePatchStore = create<PatchStore>((set) => ({
  applying: false,
  activeIndex: null,
  status: '',
  percent: -1,
  speed: 0,
  result: null,
  confirmTarget: null,

  resetForGame: () =>
    set({
      applying: false,
      activeIndex: null,
      status: '',
      percent: -1,
      speed: 0,
      result: null,
      confirmTarget: null
    }),

  setApplying: (applying, index) => set({ applying, activeIndex: index }),
  setProgress: (status, percent, speed) =>
    set((s) => ({ status: status || s.status, percent, speed })),
  setResult: (result) => set({ result }),
  openConfirm: (index) => set({ confirmTarget: index }),
  closeConfirm: () => set({ confirmTarget: null })
}))
