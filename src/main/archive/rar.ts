/**
 * RAR-specific archive handling. `7zip-bin`'s bundled `7za` binary is the "light"
 * variant of 7-Zip that only understands 7z/zip/gzip/bzip2/tar — it can't read RAR at
 * all ("Cannot open the file as archive" on every .rar, even a perfectly valid one).
 * `node-unrar-js` wraps RARLab's own C++ unrar source compiled to WASM, so it handles
 * RAR the same way the real unrar/WinRAR would, with no separate native binary to bundle
 * per-platform.
 *
 * Both APIs here use the file-based extractor (`createExtractorFromFile`), not the
 * in-memory one — patch archives can be up to several GB, and the in-memory API would
 * require holding the whole archive in a JS ArrayBuffer at once.
 */
import { mkdir } from 'node:fs/promises'
import { createExtractorFromFile } from 'node-unrar-js'
import log from 'electron-log'

export function isRarFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.rar')
}

/** Returns true if the archive opens and its file list parses without error. */
export async function testRarIntegrity(archivePath: string): Promise<boolean> {
  try {
    const extractor = await createExtractorFromFile({ filepath: archivePath })
    const list = extractor.getFileList()
    // The header/file-list generators are lazy — spreading forces every entry to
    // actually be parsed, which is what surfaces a corrupt/truncated archive as a thrown
    // UnrarError instead of silently reporting zero files.
    ;[...list.fileHeaders]
    return true
  } catch (err) {
    log.warn(`[archive/rar] Integrity test failed for ${archivePath}: ${err}`)
    return false
  }
}

export async function extractRar(archivePath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true })
  const extractor = await createExtractorFromFile({ filepath: archivePath, targetPath: destDir })
  // Extraction is also lazy — nothing is written to destDir until this generator is
  // actually iterated.
  const { files } = extractor.extract()
  ;[...files]
}
