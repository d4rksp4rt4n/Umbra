/**
 * IPC surface for settings (incl. the Beta Auto-Install toggle), the download/apply
 * pipeline, cache management, and the update check. Kept separate from ipc/handlers.ts
 * (library loading) since these are a distinct concern with their own imports.
 */
import { ipcMain, shell, dialog, type IpcMainInvokeEvent } from 'electron'
import { mkdir, readdir, rm } from 'node:fs/promises'
import log from 'electron-log'
import { getSettings, updateSettings } from '@main/config/settings'
import { resolveCacheDir } from '@main/config/paths'
import { getSteamPath } from '@main/steam/discovery'
import { getInstalledGames } from '@main/steam/library'
import { processPatch } from '@main/patch/processPatch'
import { readInstructionFile } from '@main/patch/instructions'
import { checkForUpdate } from '@main/update/checkUpdate'
import type {
  AppSettings,
  InstructionContent,
  PatchApplyRequest,
  PatchApplyResponse,
  UpdateCheckResult
} from '@shared/types'

export function registerPatchIpcHandlers(): void {
  ipcMain.handle('settings:get', (): AppSettings => getSettings())

  ipcMain.handle('settings:set', (_event, patch: Partial<AppSettings>): AppSettings =>
    updateSettings(patch)
  )

  ipcMain.handle(
    'patch:apply',
    async (event: IpcMainInvokeEvent, request: PatchApplyRequest): Promise<PatchApplyResponse> => {
      const send = (payload: { status: string; percent: number; speed: number }): void => {
        event.sender.send('patch:progress', payload)
      }

      try {
        const settings = getSettings()
        const steamPath = await getSteamPath()
        if (!steamPath) throw new Error('Steam installation not found.')

        const installed = await getInstalledGames(steamPath)
        const cacheDir = resolveCacheDir(settings.cacheDirOverride)

        const result = await processPatch({
          files: request.files,
          selectedIndices: request.selectedIndices,
          installed,
          appid: request.appid,
          gameName: request.gameName,
          cacheDir,
          betaAutoInstall: settings.betaAutoInstall,
          forceDownloadOnly: request.forceDownloadOnly,
          forceApply: request.forceApply,
          onStatus: (status) => send({ status, percent: -1, speed: 0 }),
          onProgress: (p) => send({ status: '', percent: p.percent, speed: p.speed })
        })

        return {
          ok: true,
          mode: result.mode,
          installDir: result.installDir,
          cachedPaths: result.cachedPaths,
          appliedFile: result.appliedFile,
          changes: result.changes,
          error: null
        }
      } catch (err) {
        log.error('[ipc/patch:apply] failed:', err)
        send({ status: 'FAILED', percent: -1, speed: 0 })
        return {
          ok: false,
          mode: 'manual',
          installDir: null,
          cachedPaths: [],
          appliedFile: null,
          changes: null,
          error: err instanceof Error ? err.message : String(err)
        }
      }
    }
  )

  // Reveals a folder in the OS file manager — used after a manual-mode download so the
  // user can find the cached patch file and the game's install dir to apply it themselves.
  ipcMain.handle('shell:openPath', async (_event, path: string): Promise<string | null> => {
    const errorMessage = await shell.openPath(path)
    return errorMessage || null
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string): Promise<void> => {
    await shell.openExternal(url)
  })

  ipcMain.handle('cache:open', async (): Promise<string | null> => {
    const settings = getSettings()
    const cacheDir = resolveCacheDir(settings.cacheDirOverride)
    await mkdir(cacheDir, { recursive: true })
    const errorMessage = await shell.openPath(cacheDir)
    return errorMessage || null
  })

  ipcMain.handle('cache:clear', async (): Promise<{ deleted: number }> => {
    const settings = getSettings()
    const cacheDir = resolveCacheDir(settings.cacheDirOverride)
    let deleted = 0
    try {
      const entries = await readdir(cacheDir)
      for (const entry of entries) {
        await rm(`${cacheDir}/${entry}`, { recursive: true, force: true })
        deleted++
      }
    } catch (err) {
      log.warn(`[ipc/cache:clear] ${err}`)
    }
    return { deleted }
  })

  ipcMain.handle('cache:getDir', (): string => {
    const settings = getSettings()
    return resolveCacheDir(settings.cacheDirOverride)
  })

  // Lets the renderer show "already downloaded" state per file without needing to
  // trigger a download first — the cache-reuse logic in obtainFile() already skips
  // re-downloading a valid cached file, this just exposes that state proactively.
  ipcMain.handle('cache:listFiles', async (): Promise<string[]> => {
    const settings = getSettings()
    const cacheDir = resolveCacheDir(settings.cacheDirOverride)
    try {
      const entries = await readdir(cacheDir, { withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => e.name)
    } catch {
      return []
    }
  })

  ipcMain.handle('settings:chooseCacheDir', async (): Promise<AppSettings> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose a folder for downloaded patch files'
    })
    if (result.canceled || !result.filePaths[0]) return getSettings()
    return updateSettings({ cacheDirOverride: result.filePaths[0] })
  })

  ipcMain.handle('settings:resetCacheDir', (): AppSettings => updateSettings({ cacheDirOverride: null }))

  ipcMain.handle(
    'instructions:read',
    async (_event, filePath: string): Promise<InstructionContent> => readInstructionFile(filePath)
  )

  ipcMain.handle('update:check', async (): Promise<UpdateCheckResult> => checkForUpdate())
}
