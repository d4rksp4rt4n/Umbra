/**
 * Cross-references every DB entry's appid against the locally installed Steam games,
 * producing a sorted list of matches plus an appid-keyed lookup for fast access.
 */
import log from 'electron-log'
import type { GameMatch, InstalledGamesMap, PatchDbEntry } from '@shared/types'

export interface MatchResult {
  matches: GameMatch[]
  byId: Record<string, GameMatch>
}

export function buildMatches(installed: InstalledGamesMap, entries: PatchDbEntry[]): MatchResult {
  const installedAppIds = new Set(Object.keys(installed))
  log.info(`[database/match] Database contains ${entries.length} entries`)
  log.info(`[database/match] Installed appid count: ${installedAppIds.size}`)

  const matches: GameMatch[] = []
  const byId: Record<string, GameMatch> = {}

  for (const entry of entries) {
    const appidRaw = entry.appid
    if (!appidRaw) continue
    const appid = String(appidRaw).trim()
    if (!installedAppIds.has(appid)) continue

    const match: GameMatch = {
      appid,
      gameName: entry.game ?? 'Unknown',
      devName: (entry.developer as string | undefined) ?? 'Unknown',
      data: entry
    }
    matches.push(match)
    byId[appid] = match
  }

  matches.sort((a, b) => a.gameName.toLowerCase().localeCompare(b.gameName.toLowerCase()))

  log.info(`[database/match] Total matches found: ${matches.length}`)
  return { matches, byId }
}

/**
 * Sort priority used by the list/grid views: favorites-with-update first, then any
 * update, then plain favorites, then everything else — alphabetical within each tier.
 */
export function sortMatchesForDisplay(
  matches: GameMatch[],
  favorites: Set<string>,
  hasUpdate: (match: GameMatch) => boolean
): GameMatch[] {
  const tier = (m: GameMatch): number => {
    const fav = favorites.has(m.appid)
    const upd = hasUpdate(m)
    if (fav && upd) return 0
    if (upd) return 1
    if (fav) return 2
    return 3
  }

  return [...matches].sort((a, b) => {
    const t = tier(a) - tier(b)
    if (t !== 0) return t
    return a.gameName.toLowerCase().localeCompare(b.gameName.toLowerCase())
  })
}
