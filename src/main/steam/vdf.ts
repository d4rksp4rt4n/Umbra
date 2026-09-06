/**
 * Field extraction from Valve's KeyValues (.vdf) text format.
 *
 * Both files this app reads need exactly one field each, so neither gets a real parse.
 * A recursive-descent KeyValues parser lived here previously and existed solely to let
 * `extractLibraryFolderPaths` walk one level down to `"path"` — 80 lines of generic
 * machinery for a single string lookup, with no other caller. Scanning for the field
 * directly is the same answer in one line.
 */

/**
 * Extracts every library folder path from `libraryfolders.vdf`.
 *
 * A regex rather than a real parse: the only thing wanted from the file is the `"path"`
 * of each entry, and every caller feeds the result through `existsSync` (see
 * steam/library.ts), so anything this picks up by mistake is filtered out for free.
 * Pre-2019 Steam wrote the path directly on the index key instead of under `"path"`;
 * that shape is not handled, and a client that old cannot run this app anyway. The
 * default steamapps folder is always scanned regardless of what this returns.
 */
export function extractLibraryFolderPaths(vdfText: string): string[] {
  return [...vdfText.matchAll(/"path"\s*"([^"]+)"/g)].map((m) => m[1])
}

/**
 * Raw scan for `"installdir"` inside an appmanifest_*.acf file — reads line-by-line and
 * splits on quotes rather than doing a full parse, since this is the only field needed.
 * Returns null if no installdir line is found.
 */
export function extractInstallDirFromAcf(acfText: string): string | null {
  for (const line of acfText.split(/\r?\n/)) {
    if (line.includes('"installdir"')) {
      // Line looks like:  "installdir"    "Game Folder Name"
      // Splitting on quotes puts the value at index 3.
      const parts = line.split('"')
      if (parts.length > 3) return parts[3]
      return null
    }
  }
  return null
}
