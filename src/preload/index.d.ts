import type { PatcherApi } from './index'

declare global {
  interface Window {
    patcher: PatcherApi
  }
}

export {}
