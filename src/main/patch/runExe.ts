/**
 * Runs a downloaded self-extracting .exe patch. These patches are typically plain SFX
 * archives (7-Zip SFX, WinRAR SFX), not real installers — running them with no arguments
 * is the correct default (matches what a user double-clicking it would get), so that's
 * the primary path now. Silent-installer flags (Inno Setup / NSIS) are only tried as a
 * fallback if the plain run won't even spawn, in case a patch genuinely is a real
 * installer.
 *
 * ONLY ever called when Beta Auto-Install is enabled and the user has confirmed the
 * per-patch warning dialog — see main/patch/processPatch.ts. Running arbitrary downloaded
 * executables is inherently risky; this module doesn't make that safer, it just automates
 * the run.
 */
import { spawn } from 'node:child_process'
import log from 'electron-log'

const SILENT_FALLBACK_FLAG_SETS = [
  ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'], // Inno Setup
  ['/S'] // NSIS
]

function spawnOnce(exePath: string, flags: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(exePath, flags, { cwd, windowsHide: true })
    let stderr = ''
    proc.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf-8')))
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`exit code ${code}${stderr ? `: ${stderr.trim()}` : ''}`))
    })
  })
}

/** Windows commonly holds a brief exclusive lock on a freshly-downloaded executable while
 *  antivirus real-time protection scans it — spawning immediately after the download
 *  finishes can hit that window and fail with EACCES even though the file is completely
 *  fine. A couple of short retries covers this without adding a fixed, always-paid delay
 *  for the common case where no AV lock is in play. */
async function spawnWithAvLockRetry(exePath: string, flags: string[], cwd: string): Promise<void> {
  const delaysMs = [0, 800, 2000]
  let lastError: unknown = null

  for (const delay of delaysMs) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    try {
      await spawnOnce(exePath, flags, cwd)
      return
    } catch (err) {
      lastError = err
      const isEacces = err instanceof Error && 'code' in err && err.code === 'EACCES'
      if (!isEacces) throw err // not a lock issue — no point retrying
      log.warn(`[patch/runExe] EACCES spawning ${exePath}, retrying after AV scan window...`)
    }
  }

  throw lastError
}

export async function runSelfExtractingExe(exePath: string, cwd: string): Promise<void> {
  try {
    await spawnWithAvLockRetry(exePath, [], cwd)
    return
  } catch (plainRunError) {
    log.warn(`[patch/runExe] Plain run failed, trying silent-installer flag sets: ${plainRunError}`)
  }

  let lastError: unknown = null
  for (const flags of SILENT_FALLBACK_FLAG_SETS) {
    try {
      await spawnWithAvLockRetry(exePath, flags, cwd)
      return
    } catch (err) {
      lastError = err
    }
  }

  throw new Error(
    `Self-extracting EXE failed to run (tried plain run and silent-installer flags)${lastError ? `: ${String(lastError)}` : ''}`
  )
}
