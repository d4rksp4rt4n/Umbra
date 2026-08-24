import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  InstructionContent,
  LibraryLoadResult,
  PatchApplyRequest,
  PatchApplyResponse,
  PatchProgressEvent,
  UpdateCheckResult
} from '@shared/types'

const api = {
  loadLibrary: (): Promise<LibraryLoadResult> => ipcRenderer.invoke('library:load'),
  toggleFavorite: (appid: string): Promise<string[]> =>
    ipcRenderer.invoke('favorites:toggle', appid),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),
  chooseCacheDir: (): Promise<AppSettings> => ipcRenderer.invoke('settings:chooseCacheDir'),
  resetCacheDir: (): Promise<AppSettings> => ipcRenderer.invoke('settings:resetCacheDir'),

  applyPatch: (request: PatchApplyRequest): Promise<PatchApplyResponse> =>
    ipcRenderer.invoke('patch:apply', request),
  onPatchProgress: (callback: (event: PatchProgressEvent) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: PatchProgressEvent): void =>
      callback(payload)
    ipcRenderer.on('patch:progress', listener)
    return () => ipcRenderer.removeListener('patch:progress', listener)
  },

  readInstructions: (filePath: string): Promise<InstructionContent> =>
    ipcRenderer.invoke('instructions:read', filePath),

  openPath: (path: string): Promise<string | null> => ipcRenderer.invoke('shell:openPath', path),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),

  openCacheFolder: (): Promise<string | null> => ipcRenderer.invoke('cache:open'),
  clearCache: (): Promise<{ deleted: number }> => ipcRenderer.invoke('cache:clear'),
  getCacheDir: (): Promise<string> => ipcRenderer.invoke('cache:getDir'),
  listCachedFiles: (): Promise<string[]> => ipcRenderer.invoke('cache:listFiles'),

  checkForUpdate: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('update:check')
}

export type PatcherApi = typeof api

contextBridge.exposeInMainWorld('patcher', api)
