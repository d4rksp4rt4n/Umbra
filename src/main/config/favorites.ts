/**
 * Favourited appids, stored as a sorted JSON array (a Set has no native JSON form).
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import log from 'electron-log'
import { getFavoritesPath } from './paths'

export async function loadFavorites(): Promise<Set<string>> {
  const path = getFavoritesPath()
  if (!existsSync(path)) return new Set()
  try {
    const raw = JSON.parse(await readFile(path, 'utf-8')) as unknown
    if (Array.isArray(raw)) return new Set(raw.map(String))
  } catch (err) {
    log.warn(`[config/favorites] Failed to load favorites: ${err}`)
  }
  return new Set()
}

export async function saveFavorites(favorites: Set<string>): Promise<void> {
  const path = getFavoritesPath()
  await mkdir(dirname(path), { recursive: true })
  const sorted = [...favorites].sort()
  await writeFile(path, JSON.stringify(sorted), 'utf-8')
}
