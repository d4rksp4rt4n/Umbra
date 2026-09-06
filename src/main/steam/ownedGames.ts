/**
 * The user's *owned* Steam library, as opposed to the *installed* one that
 * steam/library.ts derives from appmanifest files.
 *
 * There is no local file that lists owned games. Everything Steam writes to disk is
 * either the wrong question or unreadable:
 *   - `userdata/<id>/config/localconfig.vdf` only has apps that were *launched*
 *     (essentially every entry carries LastPlayed), so it misses owned-never-played
 *     and isn't ownership in the first place.
 *   - `userdata/<id>/config/licensecache` is encrypted.
 *   - `appcache/librarycache/` includes anything the client rendered a capsule for,
 *     store browsing included — far more than the library.
 *
 * And the keyless remote route is gone: `steamcommunity.com/<id>/games?xml=1` now 302s
 * to /login for anonymous callers even when the profile is fully public
 * (verified against public profiles, both with and without a browser User-Agent).
 * The remaining server-side routes all need a credential — a Steam Web API key or a
 * logged-in session cookie.
 *
 * So ownership is *imported* rather than fetched: the user saves
 * `store.steampowered.com/dynamicstore/userdata/` from a browser they're already signed
 * in to, and picks the file. That keeps this app credential-free — nothing to store,
 * nothing to leak, nothing to revoke — at the cost of the list being a snapshot the user
 * refreshes manually.
 *
 * A saved SteamDB calculator page was supported here too and has been removed. It found
 * zero patchable games this endpoint doesn't (476 vs 443 on the author's library, a
 * strict superset), in a file 3.4x larger, and its table is lazy-rendered behind an
 * `&all_games` view — so a save made before scrolling yields a handful of rows that
 * parse cleanly and silently import as a near-empty library. One format that cannot
 * half-succeed beats two.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import log from 'electron-log'
import type { OwnedLibrary } from '@shared/types'
import { getOwnedGamesPath } from '@main/config/paths'

/**
 * Extracts owned appids from a saved `dynamicstore/userdata` response.
 *
 * Throws with a message aimed at the user rather than at a log file — this surfaces
 * directly in the Settings dialog.
 */
export function parseOwnedExport(text: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(
      'That file is not the Steam userdata JSON. Open store.steampowered.com/dynamicstore/userdata/ while signed in and save the page.'
    )
  }

  const raw = (parsed as { rgOwnedApps?: unknown })?.rgOwnedApps
  if (!Array.isArray(raw)) {
    throw new Error(
      "That JSON has no owned-games list in it. Make sure you saved store.steampowered.com/dynamicstore/userdata/ and not another page."
    )
  }
  if (raw.length === 0) {
    throw new Error(
      'That file\'s owned-games list is empty — it looks like you were signed out of Steam when you saved it. Sign in, reload the page, and save it again.'
    )
  }

  return [...new Set(raw.filter((v) => Number.isInteger(v)).map(String))]
}

/** Reads and parses an export file chosen by the user. */
export async function importOwnedFromFile(filePath: string): Promise<string[]> {
  return parseOwnedExport(await readFile(filePath, 'utf-8'))
}

const EMPTY: OwnedLibrary = { appids: [], syncedAt: null }

export async function loadOwnedLibrary(): Promise<OwnedLibrary> {
  const path = getOwnedGamesPath()
  if (!existsSync(path)) return EMPTY
  try {
    const raw = JSON.parse(await readFile(path, 'utf-8')) as Partial<OwnedLibrary>
    if (!Array.isArray(raw.appids)) return EMPTY
    return { ...EMPTY, ...raw }
  } catch (err) {
    log.warn(`[steam/ownedGames] Failed to load owned games: ${err}`)
    return EMPTY
  }
}

export async function saveOwnedLibrary(library: OwnedLibrary): Promise<void> {
  const path = getOwnedGamesPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(library), 'utf-8')
}

export async function clearOwnedLibrary(): Promise<void> {
  await rm(getOwnedGamesPath(), { force: true })
}
