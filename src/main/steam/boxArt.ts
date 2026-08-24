/**
 * Locates the best box-art image on disk for a given appid. This module's job ends at
 * "here is the file path" — sizing and cropping are handled by CSS `object-fit` in the
 * renderer, which is faster than compositing the image here and avoids passing image
 * bytes over IPC.
 *
 * Search order:
 *   1. Modern flat files: appcache/librarycache/<appid>_library_600x900.{jpg,jpeg,png}
 *   2. Legacy deep scan: appcache/librarycache/<appid>/**, filtered to filenames containing
 *      library_600x900 / capsule / header / hero
 *   3. Custom Steam grid art: userdata/<user>/config/grid/<appid>p.{png,jpg,jpeg}
 * Custom grid art always wins if present (most recently modified). Otherwise candidates
 * are ranked by keyword preference (library_600x900 > capsule > header > hero, excluding
 * "hero...blur" variants), most-recently-modified within the winning tier.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png'] as const

interface Candidate {
  path: string
  mtimeMs: number
}

function statCandidate(path: string): Candidate | null {
  try {
    const st = statSync(path)
    if (st.isFile()) return { path, mtimeMs: st.mtimeMs }
  } catch {
    /* not found */
  }
  return null
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      results.push(...walkDir(full))
    } else if (st.isFile()) {
      results.push(full)
    }
  }
  return results
}

function newest(candidates: Candidate[]): string | null {
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a)).path
}

const boxArtPathCache = new Map<string, string | null>()

/** Resolves the best box-art file path on disk for a given appid, or null if none exists. */
export function resolveBoxArtPath(steamPath: string, appid: string): string | null {
  const cacheKey = `${steamPath}::${appid}`
  if (boxArtPathCache.has(cacheKey)) return boxArtPathCache.get(cacheKey)!

  const cacheDir = join(steamPath, 'appcache', 'librarycache')
  const userdataDir = join(steamPath, 'userdata')

  const candidates: Candidate[] = []
  const customGrid: Candidate[] = []

  // 1. Modern flat files
  for (const ext of IMAGE_EXTS) {
    const c = statCandidate(join(cacheDir, `${appid}_library_600x900.${ext}`))
    if (c) candidates.push(c)
  }

  // 2. Legacy deep scan
  const legacyDir = join(cacheDir, appid)
  if (existsSync(legacyDir)) {
    for (const file of walkDir(legacyDir)) {
      const lower = file.toLowerCase()
      if (!IMAGE_EXTS.some((ext) => lower.endsWith(`.${ext}`))) continue
      if (['library_600x900', 'capsule', 'header', 'hero'].some((k) => lower.includes(k))) {
        const c = statCandidate(file)
        if (c) candidates.push(c)
      }
    }
  }

  // 3. Custom Steam grid art (per-user)
  if (existsSync(userdataDir)) {
    let users: string[] = []
    try {
      users = readdirSync(userdataDir).filter((u) => statSync(join(userdataDir, u)).isDirectory())
    } catch {
      users = []
    }
    for (const user of users) {
      const gridDir = join(userdataDir, user, 'config', 'grid')
      if (!existsSync(gridDir)) continue
      for (const ext of ['p.png', 'p.jpg', 'p.jpeg']) {
        const c = statCandidate(join(gridDir, `${appid}${ext}`))
        if (c) {
          customGrid.push(c)
          break
        }
      }
    }
  }

  let best: string | null = null

  if (customGrid.length > 0) {
    best = newest(customGrid)
  } else if (candidates.length > 0) {
    const tiers: ((c: Candidate) => boolean)[] = [
      (c) => c.path.toLowerCase().includes('library_600x900'),
      (c) => c.path.toLowerCase().includes('capsule'),
      (c) => c.path.toLowerCase().includes('header'),
      (c) => c.path.toLowerCase().includes('hero') && !c.path.toLowerCase().includes('blur')
    ]
    for (const matchesTier of tiers) {
      const tierMatches = candidates.filter(matchesTier)
      if (tierMatches.length > 0) {
        best = newest(tierMatches)
        break
      }
    }
    if (!best) best = newest(candidates)
  }

  if (!best) {
    log.debug(`[steam/boxArt] No box art found for appid ${appid}`)
  }

  boxArtPathCache.set(cacheKey, best)
  return best
}

/** Call after a fresh database/library refresh if art on disk may have changed mid-session. */
export function clearBoxArtCache(): void {
  boxArtPathCache.clear()
}
