/**
 * Orchestrates the download → (optionally) extract → apply pipeline. Everything through
 * "a valid file sits in the cache folder" is common to both modes; what happens after
 * that branches on the Beta Auto-Install setting.
 *
 *   Beta OFF (default): stop after caching. Report the cached file paths back to the
 *   renderer so it can open the install dir + cache folder — no extraction, no writes
 *   into the game folder, no process execution beyond 7z's own integrity test.
 *
 *   Beta ON: extract (or run, for .exe) each non-instruction file into a temp dir, then
 *   smart-apply it into the install dir, then persist the per-game config. Only reached
 *   after the caller has confirmed the per-patch warning dialog.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import log from 'electron-log'
import type { PatchFile } from '@shared/types'
import { isViewableInstructionFile } from '@shared/fileKind'
import { obtainFile } from './cache'
import { extractArchive } from '@main/archive'
import { runSelfExtractingExe } from './runExe'
import { smartApplyPatch, assertValidInstallDir, type SmartApplyChanges } from './smartApply'
import { savePerGameConfig } from '@main/config/perGameConfig'
import type { InstalledGamesMap } from '@shared/types'
import type { ProgressCallback } from '@main/download/googleDrive'

interface ProcessPatchParams {
  files: PatchFile[]
  selectedIndices: number[]
  installed: InstalledGamesMap
  appid: string
  gameName: string
  cacheDir: string
  betaAutoInstall: boolean
  /** Overrides betaAutoInstall to false for this call only — used by the "Open patch
   *  file" action, which must always be a pure download regardless of the Beta setting. */
  forceDownloadOnly?: boolean
  /** Forces the apply pipeline (extract/run + smart-apply) to run even if
   *  betaAutoInstall is off. Set only by the renderer's "Install patch" button, only
   *  after the user has confirmed the per-patch warning dialog — this is what lets .exe
   *  patches always have a working "Install patch" action regardless of the Beta
   *  setting, since there's no manual alternative for running an installer. The Beta
   *  setting still gates whether "Install patch" is even *shown* for archives; this flag
   *  is what makes a shown, clicked button actually execute. */
  forceApply?: boolean
  onStatus: (message: string) => void
  onProgress: ProgressCallback
}

interface ProcessPatchResult {
  mode: 'manual' | 'beta'
  /** Null when the game isn't installed — download-only, nothing to apply into. */
  installDir: string | null
  /** Populated in manual mode: local cache paths of every downloaded file, so the
   *  renderer can open them / reveal them in the file manager. */
  cachedPaths: string[]
  /** Populated in beta mode: the non-instruction file name that was actually applied,
   *  recorded in the per-game config. */
  appliedFile: string | null
  changes: SmartApplyChanges | null
}

export async function processPatch(params: ProcessPatchParams): Promise<ProcessPatchResult> {
  const {
    files,
    selectedIndices,
    installed,
    appid,
    gameName,
    cacheDir,
    betaAutoInstall,
    forceDownloadOnly = false,
    forceApply = false,
    onStatus,
    onProgress
  } = params

  // forceDownloadOnly wins regardless of the Beta setting — this is what makes "Open
  // patch file" a safe, always-available pure-download action. forceApply is the
  // opposite override: it makes the apply pipeline run even with Beta off, but only
  // because the renderer only sets it after the user explicitly confirmed the per-patch
  // warning dialog for this specific action.
  const effectiveBeta = (betaAutoInstall || forceApply) && !forceDownloadOnly

  // A game surfaced by the owned-but-not-installed feature has no entry here. That's a
  // hard stop for anything that writes or executes, but downloading its patch files into
  // the cache is still perfectly valid — the user can install the game later and apply
  // them then. So the missing-install-dir check is scoped to the apply path only.
  const game = installed[appid] ?? null
  if (effectiveBeta) {
    if (!game) {
      throw new Error(
        `${gameName} isn't installed, so there's no game folder to apply a patch into. Install it on Steam first.`
      )
    }
    assertValidInstallDir(game.installDir)
  }

  const cachedPaths: string[] = []
  let appliedFile: string | null = null
  let changes: SmartApplyChanges | null = null

  for (const idx of selectedIndices) {
    const file = files[idx]
    if (!file) continue
    if (!file.id) {
      log.warn(`[patch/process] Skipping ${file.name}: no Drive file id`)
      continue
    }

    const cachePath = join(cacheDir, file.name)
    const localPath = await obtainFile({
      fileId: file.id,
      fileName: file.name,
      rawSize: file.size,
      cachePath,
      onProgress,
      onStatus
    })
    cachedPaths.push(localPath)

    // Instructions (.txt/.docx/.pdf) are always just downloaded and opened, never
    // extracted/applied — regardless of the Beta setting. This has to come *after* the
    // download above (not skip it outright), since the "View" action in the renderer
    // goes through this same function to fetch the file it's about to open.
    if (isViewableInstructionFile(file.name)) continue

    if (!effectiveBeta) {
      appliedFile = file.name
      continue
    }

    onStatus(`Extracting: ${file.path}`)
    const tempDir = await mkdtemp(join(tmpdir(), 'sgp-'))
    try {
      if (extname(localPath).toLowerCase() === '.exe') {
        await runSelfExtractingExe(localPath, tempDir)
      } else {
        await extractArchive(localPath, tempDir, (pct) => onProgress({ percent: pct, bytesDownloaded: 0, speed: 0 }))
      }

      onStatus(`Applying: ${file.path}`)
      // Non-null: effectiveBeta is the only route here, and it already threw above if
      // the game isn't installed.
      changes = await smartApplyPatch(tempDir, game!.installDir, onStatus)
      appliedFile = file.name
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  if (effectiveBeta && appliedFile) {
    const today = new Date().toISOString().slice(0, 10)
    await savePerGameConfig(
      installed,
      appid,
      gameName,
      appliedFile,
      today,
      changes ?? { overwritten: [], added: [], skipped: null }
    )
  }

  onStatus('SUCCESS')
  return {
    mode: effectiveBeta ? 'beta' : 'manual',
    installDir: game?.installDir ?? null,
    cachedPaths,
    appliedFile,
    changes
  }
}
