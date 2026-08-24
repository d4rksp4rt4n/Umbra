/**
 * Single entry point for archive handling — callers (cache.ts, processPatch.ts) don't
 * need to know that RAR requires a completely different library than everything else.
 */
import { extname } from 'node:path'
import * as sevenZip from './sevenZip'
import * as rar from './rar'

export async function testArchiveIntegrity(archivePath: string): Promise<boolean> {
  if (rar.isRarFile(archivePath)) return rar.testRarIntegrity(archivePath)
  return sevenZip.testArchiveIntegrity(archivePath)
}

export async function extractArchive(
  archivePath: string,
  destDir: string,
  onProgress?: sevenZip.ExtractProgressCallback
): Promise<void> {
  if (rar.isRarFile(archivePath)) {
    // node-unrar-js doesn't expose extraction progress, unlike 7z's -bsp1 stdout parsing.
    await rar.extractRar(archivePath, destDir)
    onProgress?.(100)
    return
  }
  return sevenZip.extractArchive(archivePath, destDir, onProgress)
}

export type { ExtractProgressCallback } from './sevenZip'
