/**
 * Uses HTTP conditional GET (If-None-Match / ETag) so repeat launches don't
 * re-download the full database when nothing changed on GitHub — a 304 means
 * "up to date", any other 2xx means the body is written to disk and the new
 * ETag is cached for next time.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, utimes } from 'node:fs/promises'
import { dirname } from 'node:path'
import log from 'electron-log'
import { DB_URL } from '@shared/constants'
import { getDbPath, getDbEtagPath } from '@main/config/paths'

export interface DatabaseFetchResult {
  /** True if a fresh copy was downloaded; false if the cached copy on disk is still current
   *  (304 Not Modified) or the fetch failed and we're falling back to whatever is cached. */
  updated: boolean
  /** True if a usable database file exists on disk after this call. */
  available: boolean
}

/**
 * Downloads the remote patches database if it has changed, writing it to disk alongside
 * its ETag. On any network failure, leaves the existing cached file (if any) untouched
 * and reports `updated: false` — a fail-soft fallback rather than blocking startup.
 */
export async function downloadDatabase(fetchImpl: typeof fetch = fetch): Promise<DatabaseFetchResult> {
  const dbPath = getDbPath()
  const etagPath = getDbEtagPath()

  await mkdir(dirname(dbPath), { recursive: true })

  const headers: Record<string, string> = {}
  if (existsSync(dbPath) && existsSync(etagPath)) {
    try {
      headers['If-None-Match'] = (await readFile(etagPath, 'utf-8')).trim()
    } catch {
      // ignore — proceed with an unconditional request
    }
  }

  try {
    const res = await fetchImpl(DB_URL, { headers, signal: AbortSignal.timeout(15_000) })

    if (res.status === 304) {
      log.info('[database/fetch] Database up to date (304)')
      const now = new Date()
      await utimes(dbPath, now, now).catch(() => {})
      return { updated: false, available: true }
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    const text = await res.text()
    await writeFile(dbPath, text, 'utf-8')

    const etag = res.headers.get('etag')
    if (etag) {
      await writeFile(etagPath, etag, 'utf-8')
    }

    log.info('[database/fetch] Database updated from GitHub')
    return { updated: true, available: true }
  } catch (err) {
    log.error(`[database/fetch] Database update failed: ${err}`)
    return { updated: false, available: existsSync(dbPath) }
  }
}
