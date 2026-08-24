/**
 * Reads <steam>/steamapps/libraryfolders.vdf to discover every Steam library
 * (not just the default one), then scans each library's `appmanifest_*.acf`
 * files to build a map of appid -> install directory, verifying the directory
 * actually exists on disk (a game can have a manifest but be partially
 * uninstalled or corrupted).
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import log from 'electron-log'
import type { InstalledGamesMap } from '@shared/types'
import { extractLibraryFolderPaths, extractInstallDirFromAcf } from './vdf'

async function readFileIfExists(path: string): Promise<string | null> {
  if (!existsSync(path)) return null
  try {
    return await readFile(path, 'utf-8')
  } catch (err) {
    log.warn(`[steam/library] Failed to read ${path}:`, err)
    return null
  }
}

function listAppManifests(steamappsDir: string): string[] {
  try {
    return readdirSync(steamappsDir).filter(
      (f) => f.startsWith('appmanifest_') && f.endsWith('.acf')
    )
  } catch {
    return []
  }
}

/**
 * Scan every Steam library folder for installed games.
 * @param steamPath Root Steam installation directory, as returned by getSteamPath().
 */
export async function getInstalledGames(steamPath: string): Promise<InstalledGamesMap> {
  const installed: InstalledGamesMap = {}

  const defaultSteamapps = join(steamPath, 'steamapps')
  const libraries = [defaultSteamapps]

  const libraryFoldersVdf = join(defaultSteamapps, 'libraryfolders.vdf')
  const vdfText = await readFileIfExists(libraryFoldersVdf)
  if (vdfText) {
    try {
      for (const path of extractLibraryFolderPaths(vdfText)) {
        if (path && existsSync(path)) {
          libraries.push(join(path, 'steamapps'))
        }
      }
    } catch (err) {
      log.warn(`[steam/library] VDF parse error: ${err}`)
    }
  }

  for (const lib of libraries) {
    const commonDir = join(lib, 'common')
    if (!existsSync(commonDir) || !statSync(commonDir).isDirectory()) continue

    for (const acfName of listAppManifests(lib)) {
      // "appmanifest_228980.acf" -> "228980"
      const appid = acfName.slice('appmanifest_'.length, -'.acf'.length)
      const acfText = await readFileIfExists(join(lib, acfName))
      if (!acfText) continue

      const dirName = extractInstallDirFromAcf(acfText)
      if (!dirName) continue

      const fullPath = join(commonDir, dirName)
      if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
        installed[appid] = { appid, installDir: fullPath }
      }
    }
  }

  log.info(`[steam/library] Found ${Object.keys(installed).length} installed Steam games`)
  return installed
}
