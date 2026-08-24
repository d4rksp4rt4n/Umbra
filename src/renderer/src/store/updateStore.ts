import { create } from 'zustand'
import type { UpdateCheckResult } from '@shared/types'

interface UpdateStore {
  result: UpdateCheckResult | null
  check: () => Promise<void>
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  result: null,
  check: async () => {
    const result = await window.patcher.checkForUpdate()
    set({ result })
  }
}))
