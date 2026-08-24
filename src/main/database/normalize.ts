/**
 * Port of the database-normalization block inside `App.__init__` (the
 * "NEW REFACTORED DATABASE SUPPORT (2026 format)" section), which:
 *   1. detects whether the DB uses the new `entries` format or the legacy `metadata` format
 *   2. flattens each entry's `contents` into a flat `files` list via flatten_game_contents()
 *   3. extracts version string + recent_changes from whichever location applies
 */
import { readFile } from 'node:fs/promises'
import type { LoadedDatabase, PatchDatabaseRaw, PatchDbEntry } from '@shared/types'
import { getDbPath } from '@main/config/paths'
import { flattenGameContents } from './flatten'

export async function loadDatabase(): Promise<LoadedDatabase> {
  const raw = JSON.parse(await readFile(getDbPath(), 'utf-8')) as PatchDatabaseRaw

  if (raw.entries) {
    const entries: PatchDbEntry[] = raw.entries.map((entry) => ({
      ...entry,
      files:
        entry.contents && (typeof entry.contents === 'object' || Array.isArray(entry.contents))
          ? flattenGameContents(entry.contents)
          : []
    }))

    // Confirmed against a real export: `generated_at` lives at the document's top level
    // (not nested under `data`, which was a guess that didn't match reality). The
    // `data`/`last_folders_metadata` fallbacks stay as a defensive fallback in case a
    // future generator run nests it differently again.
    const version =
      raw.generated_at ?? (raw.data?.generated_at != null ? String(raw.data.generated_at) : null)
    const recentChanges = raw.last_folders_metadata?.recent_changes ?? []

    return { version: version ?? 'Unknown', entries, recentChanges }
  }

  // Legacy fallback format — no per-entry flattening was ever needed here since the old
  // format stored `files` directly rather than a `contents` tree.
  const version = raw.metadata?.version ?? 'Unknown'
  const recentChanges = raw.metadata?.recent_changes ?? []
  return { version, entries: [], recentChanges }
}

/**
 * Buckets the DB's flat "recent changes" feed by game name for display in a future
 * Changes dialog. Accepts either `[appid, game, message]` tuples or `"Game - message"`
 * strings.
 */
export function groupChanges(changes: unknown[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  const push = (game: string, msg: string): void => {
    ;(grouped[game] ??= []).push(msg)
  }

  for (const item of changes) {
    if (Array.isArray(item) && item.length === 3) {
      const [, game, msg] = item as [unknown, string, string]
      push(game, msg)
    } else if (typeof item === 'string') {
      const sepIndex = item.indexOf(' - ')
      if (sepIndex !== -1) {
        push(item.slice(0, sepIndex).trim(), item.slice(sepIndex + 3).trim())
      } else {
        push('Miscellaneous', item)
      }
    } else {
      push('Miscellaneous', String(item))
    }
  }

  return grouped
}
