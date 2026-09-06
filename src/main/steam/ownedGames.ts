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
 * So ownership is *imported* rather than fetched: the user exports the list themselves
 * from a page they're already authenticated to, and hands us the file. That keeps this
 * app credential-free — nothing to store, nothing to leak, nothing to revoke — at the
 * cost of the list being a snapshot the user refreshes manually.
 *
 * Two export formats are accepted, because both are one Ctrl+S away and neither needs
 * anything pasted or typed:
 *   - a saved SteamDB calculator page (`<tr class="app" data-appid="...">` rows)
 *   - Steam's own `store.steampowered.com/dynamicstore/userdata/` JSON (`rgOwnedApps`)
 * Supporting both means a breaking change to either source leaves the other working.
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import log from 'electron-log'
import type { OwnedLibrary, OwnedSource } from '@shared/types'
import { getOwnedGamesPath } from '@main/config/paths'

/** Ceiling on an imported file, so a mis-picked file can't be slurped into memory
 *  wholesale. A saved SteamDB page for a ~2,600-game library is ~1.2 MB. */
const MAX_IMPORT_BYTES = 64 * 1024 * 1024

export interface ParsedOwned {
  appids: string[]
  source: OwnedSource
}

/**
 * Pulls appids out of a saved SteamDB calculator page.
 *
 * Scoped to `<tr class="app">` specifically rather than every `data-appid` in the
 * document — the page carries a handful of unrelated ones (hover previews and the
 * like), and the owned-games table is the only thing we want.
 */
function parseSteamDbHtml(text: string): string[] {
  const appids = new Set<string>()
  // Attribute order isn't guaranteed across SteamDB revisions, so match the whole
  // opening tag and test its attributes separately instead of pinning class before
  // data-appid.
  const rowTag = /<tr\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = rowTag.exec(text)) !== null) {
    const attrs = m[1]
    if (!/\bclass\s*=\s*"[^"]*\bapp\b[^"]*"/i.test(attrs)) continue
    const idMatch = /\bdata-appid\s*=\s*"(\d+)"/i.exec(attrs)
    if (idMatch) appids.add(idMatch[1])
  }
  return [...appids]
}

/**
 * Pulls appids out of Steam's dynamicstore JSON. Also tolerates a bare array, so a user
 * who saved just the `rgOwnedApps` value rather than the whole response still works.
 */
function parseSteamUserdataJson(text: string): string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  const raw = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>).rgOwnedApps
      : null

  if (!Array.isArray(raw)) return null

  const appids = new Set<string>()
  for (const value of raw) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      appids.add(String(Math.trunc(value)))
    } else if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      appids.add(value.trim())
    }
  }
  return [...appids]
}

/**
 * Digs an `rgOwnedApps` array out of text that isn't valid JSON as a whole.
 *
 * Browsers that pretty-print JSON (Firefox's viewer, various extensions) save the
 * *viewer's* HTML rather than the raw response, which buries the payload in markup and
 * HTML-escapes its quotes. The user did everything right in that case, so recognising it
 * beats making them figure out why "save this JSON" produced something we rejected.
 */
function parseEmbeddedOwnedApps(text: string): string[] | null {
  const unescaped = text.replace(/&quot;/gi, '"').replace(/&#0*34;/g, '"')
  // rgOwnedApps is a flat array of numbers, so there are no nested brackets to balance.
  const match = /"rgOwnedApps"\s*:\s*\[([^\]]*)\]/.exec(unescaped)
  if (!match) return null

  const appids = new Set<string>()
  for (const piece of match[1].split(',')) {
    const trimmed = piece.trim().replace(/^"|"$/g, '')
    if (/^\d+$/.test(trimmed)) appids.add(trimmed)
  }
  return appids.size > 0 ? [...appids] : null
}

/**
 * Detects the format and extracts appids. Throws with a message aimed at the user
 * rather than at a log file — this surfaces directly in the Settings dialog.
 */
export function parseOwnedExport(text: string): ParsedOwned {
  const json = parseSteamUserdataJson(text)
  if (json !== null) {
    if (json.length === 0) {
      throw new Error(
        "That file's owned-games list is empty — it looks like you were signed out of Steam when you saved it. Sign in, reload the page, and save it again."
      )
    }
    return { appids: json, source: 'steam-userdata' }
  }

  // Before falling through to the SteamDB parser: a wrapped-but-present rgOwnedApps is
  // still a Steam userdata export, and reporting it as a bad SteamDB page would send the
  // user chasing the wrong problem.
  const embedded = parseEmbeddedOwnedApps(text)
  if (embedded) return { appids: embedded, source: 'steam-userdata' }

  if (/<\s*(html|!doctype|tr|table)\b/i.test(text)) {
    const html = parseSteamDbHtml(text)
    if (html.length === 0) {
      throw new Error(
        'No games found in that file. If it came from the Steam userdata page, make sure you were signed in when you saved it; if it is a SteamDB calculator page, save it once the games table has loaded.'
      )
    }
    return { appids: html, source: 'steamdb' }
  }

  throw new Error(
    'Unrecognised file. Expected the Steam userdata JSON (store.steampowered.com/dynamicstore/userdata/), or a saved SteamDB calculator page.'
  )
}

/** Reads and parses an export file chosen by the user. */
export async function importOwnedFromFile(filePath: string): Promise<ParsedOwned> {
  const { size } = await stat(filePath)
  if (size > MAX_IMPORT_BYTES) {
    throw new Error('That file is too large to be a Steam library export.')
  }
  const text = await readFile(filePath, 'utf-8')
  return parseOwnedExport(text)
}

const EMPTY: OwnedLibrary = { appids: [], syncedAt: null, source: null }

export async function loadOwnedLibrary(): Promise<OwnedLibrary> {
  const path = getOwnedGamesPath()
  if (!existsSync(path)) return EMPTY
  try {
    const raw = JSON.parse(await readFile(path, 'utf-8')) as Partial<OwnedLibrary>
    if (!Array.isArray(raw.appids)) return EMPTY
    return {
      appids: raw.appids.map(String),
      syncedAt: typeof raw.syncedAt === 'string' ? raw.syncedAt : null,
      source: raw.source === 'steamdb' || raw.source === 'steam-userdata' ? raw.source : null
    }
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
