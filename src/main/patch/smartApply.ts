/**
 * Applies an extracted patch into a game's install directory by filename matching.
 *
 * For every file in the extracted patch, look up every file in the game's install
 * directory sharing that filename (case-insensitive):
 *   - exactly one match  -> overwrite it in place (the file's real location wins over
 *                            whatever relative path the archive used)
 *   - multiple matches   -> skip it entirely; we can't safely guess which one is meant,
 *                            and guessing wrong risks corrupting the wrong install
 *   - no match           -> add it at the archive's relative path under the install dir
 *
 * This only runs when Beta Auto-Install is enabled — see main/patch/processPatch.ts.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import log from 'electron-log'

export interface SmartApplyChanges {
  overwritten: string[]
  added: string[]
  skipped: string[] | null
}

function walkFiles(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) out.push(...walkFiles(full))
    else if (st.isFile()) out.push(full)
  }
  return out
}

export async function smartApplyPatch(
  extractDir: string,
  installDir: string,
  onStatus?: (message: string) => void
): Promise<SmartApplyChanges> {
  // Index every file currently in the install dir by lowercase filename.
  const gameFilesByLowerName = new Map<string, string[]>()
  for (const path of walkFiles(installDir)) {
    const name = path.split(/[/\\]/).pop()!.toLowerCase()
    const list = gameFilesByLowerName.get(name) ?? []
    list.push(path)
    gameFilesByLowerName.set(name, list)
  }

  const overwritten: string[] = []
  const added: string[] = []
  const skipped: string[] = []

  for (const src of walkFiles(extractDir)) {
    const fileName = src.split(/[/\\]/).pop()!
    const rel = relative(extractDir, src)
    const matches = gameFilesByLowerName.get(fileName.toLowerCase()) ?? []

    if (matches.length === 1) {
      await copyFile(src, matches[0])
      overwritten.push(rel)
      onStatus?.(`OVERWRITTEN: ${fileName}`)
    } else if (matches.length > 1) {
      skipped.push(rel)
      onStatus?.(`SKIPPED (multi-match): ${fileName}`)
    } else {
      const dest = join(installDir, rel)
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(src, dest)
      added.push(rel)
      onStatus?.(`ADDED: ${fileName}`)
    }
  }

  log.info(
    `[patch/smartApply] ${overwritten.length} overwritten, ${added.length} added, ${skipped.length} skipped`
  )

  return { overwritten, added, skipped: skipped.length > 0 ? skipped : null }
}

/** Guard used by the IPC handler before ever calling smartApplyPatch — the install dir
 *  must exist and be a real directory, otherwise we'd silently create a bogus one. */
export function assertValidInstallDir(installDir: string): void {
  if (!existsSync(installDir) || !statSync(installDir).isDirectory()) {
    throw new Error(`Install directory does not exist: ${installDir}`)
  }
}
