/**
 * Cache-aware file acquisition: reuse a cached download if it passes a size-tolerance
 * check and an archive integrity test, otherwise (re-)download with up to 3 retries,
 * deleting and retrying on any failure.
 */
import { existsSync, statSync } from 'node:fs'
import { unlink, mkdir } from 'node:fs/promises'
import { dirname, extname } from 'node:path'
import log from 'electron-log'
import { downloadFromGoogleDrive, type ProgressCallback } from '@main/download/googleDrive'
import { testArchiveIntegrity } from '@main/archive'
import { parseSizeBytes } from '@shared/parseSize'

/** True if `actual` bytes is close enough to `expected` to trust: either the file is
 *  tiny and non-empty, or it's within 5% of the expected size. Small files' size strings
 *  in the database are often rounded hard enough that a strict tolerance check would
 *  reject a perfectly good download. */
function sizeIsAcceptable(actual: number, expected: number | null): boolean {
  if (expected == null) return true
  const smallOk = expected < 2048 && actual > 0
  const tolOk = Math.abs(actual - expected) <= expected * 0.05
  return smallOk || tolOk
}

export interface ObtainFileParams {
  fileId: string
  fileName: string
  rawSize: string
  cachePath: string
  onProgress: ProgressCallback
  onStatus: (message: string) => void
}

/**
 * Two UI actions can legitimately race for the exact same file — e.g. a fast double-click
 * on "View" before React re-renders the disabled state, or "Open patch file" and the
 * auto-install-after-download chain both wanting the same file at once. Without
 * coordination, two concurrent downloads both target the same `<cachePath>.part` temp
 * file: whichever finishes first renames it away to the final name, and the other then
 * crashes trying to open a `.part` file that no longer exists (the exact ENOENT bug
 * reported). Instead of trying to prevent every possible double-trigger on the UI side,
 * this map makes obtainFile itself safe under concurrency — a second caller for the same
 * cachePath just awaits the first caller's in-flight promise instead of starting its own.
 */
const inFlight = new Map<string, Promise<string>>()

export async function obtainFile(params: ObtainFileParams): Promise<string> {
  const existing = inFlight.get(params.cachePath)
  if (existing) return existing

  const promise = obtainFileInner(params).finally(() => {
    inFlight.delete(params.cachePath)
  })
  inFlight.set(params.cachePath, promise)
  return promise
}

/**
 * Ensures a valid local copy of the given Drive file exists at `cachePath`, downloading
 * (or re-downloading) as needed. Returns once a file passing the size+integrity checks is
 * on disk, or throws after 3 failed attempts.
 */
async function obtainFileInner(params: ObtainFileParams): Promise<string> {
  const { fileId, fileName, rawSize, cachePath, onProgress, onStatus } = params
  const expected = parseSizeBytes(rawSize)
  const tmpPath = `${cachePath}.part`

  await mkdir(dirname(cachePath), { recursive: true })

  if (existsSync(cachePath)) {
    const actual = statSync(cachePath).size
    if (sizeIsAcceptable(actual, expected)) {
      // .exe self-extractors aren't archives — 7z can't "test" them, so a passing size
      // check alone is enough to trust the cache for those.
      if (extname(fileName).toLowerCase() === '.exe' || (await testArchiveIntegrity(cachePath))) {
        onStatus(`Using cached file: ${fileName}`)
        return cachePath
      }
      await unlink(cachePath).catch(() => {})
      log.info(`[patch/cache] Cached copy of ${fileName} failed integrity test, discarding`)
    }
  }

  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt++) {
    onStatus(`Downloading: ${fileName}`)
    try {
      await downloadFromGoogleDrive(fileId, cachePath, onProgress)
    } catch (err) {
      lastError = err
      await unlink(cachePath).catch(() => {})
      await unlink(tmpPath).catch(() => {})
      continue
    }

    const actual = existsSync(cachePath) ? statSync(cachePath).size : 0
    if (!sizeIsAcceptable(actual, expected)) {
      lastError = new Error(`Downloaded size (${actual}) doesn't match expected (${expected})`)
      await unlink(cachePath).catch(() => {})
      continue
    }

    if (extname(fileName).toLowerCase() !== '.exe' && !(await testArchiveIntegrity(cachePath))) {
      lastError = new Error('Downloaded archive failed integrity test')
      await unlink(cachePath).catch(() => {})
      continue
    }

    return cachePath
  }

  throw new Error(
    `Download failed after 3 attempts for ${fileName}${lastError ? `: ${String(lastError)}` : ''}`
  )
}
