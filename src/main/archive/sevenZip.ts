/**
 * Archive extraction and integrity testing via 7-Zip. Uses `7zip-bin`'s bundled binaries,
 * which ship builds for all three platforms, so the archive pipeline works everywhere
 * rather than depending on a system-installed 7-Zip.
 *
 * Note: the bundled `7za` is the "light" build and cannot read RAR — see archive/rar.ts.
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import sevenBin from '7zip-bin'
import log from 'electron-log'
import { resolveAsarUnpackedPath } from '@main/util/asarPath'

export type ExtractProgressCallback = (percent: number) => void

const SEVEN_ZIP_PATH: string = resolveAsarUnpackedPath(sevenBin.path7za)

function runSevenZip(args: string[], onStdoutChunk?: (chunk: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(SEVEN_ZIP_PATH, args, { windowsHide: true })
    let stderr = ''

    proc.stdout?.on('data', (chunk: Buffer) => {
      onStdoutChunk?.(chunk.toString('utf-8'))
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })

    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`7z exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`))
    })
  })
}

/** Runs `7z t <archive>` — returns true if the archive is intact, false otherwise
 *  (never throws; a failed integrity test is an expected, handled condition upstream). */
export async function testArchiveIntegrity(archivePath: string): Promise<boolean> {
  try {
    await runSevenZip(['t', archivePath])
    return true
  } catch (err) {
    log.warn(`[archive/sevenZip] Integrity test failed for ${archivePath}: ${err}`)
    return false
  }
}

/** Extracts any archive format 7-Zip understands (.zip, .7z, .rar, ...) to `destDir`. */
export async function extractArchive(
  archivePath: string,
  destDir: string,
  onProgress?: ExtractProgressCallback
): Promise<void> {
  await mkdir(destDir, { recursive: true })

  await runSevenZip(['x', archivePath, `-o${destDir}`, '-y', '-bsp1'], (chunk) => {
    if (!onProgress) return
    const matches = [...chunk.matchAll(/\b(\d+)%/g)]
    const last = matches.at(-1)
    if (last) onProgress(parseInt(last[1], 10))
  })
}
