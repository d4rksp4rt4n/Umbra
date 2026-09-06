/**
 * Cross-references every DB entry's appid against the user's Steam games, producing a
 * sorted list of matches plus an appid-keyed lookup for fast access.
 *
 * Two tiers of "the user has this game":
 *   - *installed* — an appmanifest points at a real directory on disk, so patches can
 *     actually be applied. Always included.
 *   - *owned but not installed* — present in the imported owned-games list only (see
 *     main/steam/ownedGames.ts). Included only when the caller opts in; these rows are
 *     download-only, since there's no install directory to write into.
 */
import log from 'electron-log'
import type { GameMatch, InstalledGamesMap, PatchDbEntry } from '@shared/types'

export interface MatchResult {
  matches: GameMatch[]
  byId: Record<string, GameMatch>
}

export interface BuildMatchesOptions {
  /** Appids from the imported owned-games list. Empty when nothing has been imported. */
  owned?: Set<string>
  /** When true, DB entries in `owned` but not in `installed` become matches too. */
  includeUninstalled?: boolean
}

export function buildMatches(
  installed: InstalledGamesMap,
  entries: PatchDbEntry[],
  options: BuildMatchesOptions = {}
): MatchResult {
  const { owned = new Set<string>(), includeUninstalled = false } = options
  const installedAppIds = new Set(Object.keys(installed))
  log.info(`[database/match] Database contains ${entries.length} entries`)
  log.info(`[database/match] Installed appid count: ${installedAppIds.size}`)
  if (includeUninstalled) {
    log.info(`[database/match] Owned appid count: ${owned.size}`)
  }

  const matches: GameMatch[] = []
  const byId: Record<string, GameMatch> = {}

  for (const entry of entries) {
    const appidRaw = entry.appid
    if (!appidRaw) continue
    const appid = String(appidRaw).trim()

    const isInstalled = installedAppIds.has(appid)
    // An installed game counts as owned whether or not it's in the imported list — the
    // list can be stale, and something sitting on disk is not up for debate.
    if (!isInstalled && !(includeUninstalled && owned.has(appid))) continue

    const match: GameMatch = {
      appid,
      gameName: entry.game ?? 'Unknown',
      devName: (entry.developer as string | undefined) ?? 'Unknown',
      data: entry,
      installed: isInstalled
    }
    matches.push(match)
    byId[appid] = match
  }

  matches.sort((a, b) => a.gameName.toLowerCase().localeCompare(b.gameName.toLowerCase()))

  const uninstalled = matches.length - matches.filter((m) => m.installed).length
  log.info(
    `[database/match] Total matches found: ${matches.length}` +
      (includeUninstalled ? ` (${uninstalled} owned but not installed)` : '')
  )
  return { matches, byId }
}

/**
 * Sort priority used by the list/grid views: favorites-with-update first, then any
 * update, then plain favorites, then everything else — alphabetical within each tier.
 *
 * Installed games take the whole top half regardless of tier: an owned-but-uninstalled
 * game can't be patched without installing it first, so those rows are reference
 * material and shouldn't push actionable ones down the list.
 */
export function sortMatchesForDisplay(
  matches: GameMatch[],
  favorites: Set<string>,
  hasUpdate: (match: GameMatch) => boolean
): GameMatch[] {
  const tier = (m: GameMatch): number => {
    const fav = favorites.has(m.appid)
    const upd = hasUpdate(m)
    const base = m.installed ? 0 : 4
    if (fav && upd) return base + 0
    if (upd) return base + 1
    if (fav) return base + 2
    return base + 3
  }

  return [...matches].sort((a, b) => {
    const t = tier(a) - tier(b)
    if (t !== 0) return t
    return a.gameName.toLowerCase().localeCompare(b.gameName.toLowerCase())
  })
}
