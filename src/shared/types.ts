/**
 * Shared types used by the main process, preload bridge, and renderer.
 */

/** A single Steam game the user has installed locally. */
export interface InstalledGame {
  appid: string
  installDir: string
}

/** Map of appid -> InstalledGame. */
export type InstalledGamesMap = Record<string, InstalledGame>

/** A single downloadable/viewable file attached to a patch DB entry (post flatten_game_contents). */
export interface PatchFile {
  name: string
  path: string
  id: string | null
  mimeType: string | null
  /** Human-readable size string as stored in the DB, e.g. "12.4 MB" or "Unknown". */
  size: string
}

/** One entry from the remote patches database (old or new format, both normalize to this). */
export interface PatchDbEntry {
  appid: string
  game: string
  developer?: string
  /** Present in the new (2026) format; raw pre-flatten contents tree/list. */
  contents?: unknown
  /** Populated by flattenGameContents() before matches are built. */
  files: PatchFile[]
  [key: string]: unknown
}

/** Raw shape of the remote patches_database.json — supports both legacy and current formats. */
export interface PatchDatabaseRaw {
  // Current format (confirmed against a real patches_database.json export)
  entries?: PatchDbEntry[]
  generated_at?: string
  total_games?: number
  unique_developers?: number
  // Older/alternate shapes tolerated defensively, in case the generator changes again
  data?: { generated_at?: string; [key: string]: unknown }
  last_folders_metadata?: { recent_changes?: unknown[] }
  metadata?: { version?: string; recent_changes?: unknown[] }
}

/** A DB entry cross-referenced against an installed game. */
export interface GameMatch {
  appid: string
  gameName: string
  devName: string
  data: PatchDbEntry
}

/** Result of loading + normalizing the database, ready for matching. */
export interface LoadedDatabase {
  version: string
  entries: PatchDbEntry[]
  recentChanges: unknown[]
}

/** Record of one applied patch, written into <install_dir>/patcher_config.json under "last_patch". */
export interface LastPatchRecord {
  file: string
  date: string
  changes: {
    overwritten: string[]
    added: string[]
    skipped: string[] | null
  }
}

/** Full per-game config file contents. */
export interface PerGameConfig {
  last_patch?: LastPatchRecord
  [key: string]: unknown
}

/** appid -> { gameName -> LastPatchRecord }. */
export type LastAppliedMap = Record<string, Record<string, LastPatchRecord>>

/** Result of the library-load pipeline (steam discovery -> db fetch -> matching -> favorites/config),
 *  returned over IPC. `matches` is already priority-sorted (favorite+update > update > favorite
 *  > rest, then alphabetical) — the renderer doesn't need to re-derive that order. */
export interface LibraryLoadResult {
  steamPath: string | null
  installed: InstalledGamesMap
  dbVersion: string
  dbUpdated: boolean
  matches: GameMatch[]
  groupedChanges: Record<string, string[]>
  /** appids the user has starred. Sent as an array since Set has no JSON/IPC form. */
  favorites: string[]
  lastApplied: LastAppliedMap
  error: string | null
}

/** Request payload for the `patch:apply` IPC channel. */
export interface PatchApplyRequest {
  appid: string
  gameName: string
  files: PatchFile[]
  selectedIndices: number[]
  /** When true, only download/cache the selected files — never extract, run .exe, or
   *  write into the install dir, even if Beta Auto-Install is on. Used by the "Open
   *  patch file" action, which is always a pure download regardless of the Beta setting. */
  forceDownloadOnly?: boolean
  /** When true, runs the full extract/run + apply pipeline even if Beta Auto-Install is
   *  off. Only ever sent after the user has confirmed the per-patch warning dialog for
   *  this specific action — see the "Install patch" button. */
  forceApply?: boolean
}

/** Response payload for the `patch:apply` IPC channel. */
export interface PatchApplyResponse {
  ok: boolean
  mode: 'manual' | 'beta'
  installDir: string | null
  cachedPaths: string[]
  appliedFile: string | null
  /** Populated only for a successful Beta-mode apply — the overwritten/added/skipped
   *  file lists from smart_apply_patch, so the UI can show exactly what changed. */
  changes: { overwritten: string[]; added: string[]; skipped: string[] | null } | null
  error: string | null
}

/** Streamed over `patch:progress` while a patch:apply call is in flight. */
export interface PatchProgressEvent {
  status: string
  percent: number
  speed: number
}

/** Persisted app settings, see main/config/settings.ts. */
export interface AppSettings {
  betaAutoInstall: boolean
  cacheDirOverride: string | null
  /** Only meaningful when betaAutoInstall is true. When true, downloading a file (via
   *  "Open patch file") automatically chains into the apply step afterward instead of
   *  leaving "Install patch" as a separate manual click. The confirmation dialog before
   *  any actual write/execution still always appears regardless of this setting. */
  autoInstallAfterDownload: boolean
  /** Remembers the last list/grid toggle across app restarts. */
  viewMode: 'list' | 'grid'
}

/** appid -> local file name -> whether that patch file exists in the cache folder. */
export type CachedFilesResult = string[]

export type InstructionKind = 'text' | 'html' | 'unsupported'

export interface InstructionContent {
  kind: InstructionKind
  content: string
}

/** Result of `update:check` — see main/update/checkUpdate.ts. */
export interface UpdateCheckResult {
  available: boolean
  latestVersion: string | null
  url: string
}
