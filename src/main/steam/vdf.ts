/**
 * Minimal parser for Valve's KeyValues (.vdf) text format.
 *
 * `libraryfolders.vdf` is a genuinely nested structure and gets a real (if small)
 * recursive-descent parser. `appmanifest_*.acf` files only ever need one field, so they
 * get a fast raw line-scan instead — see extractInstallDirFromAcf below.
 *
 * Only string values and nested objects are supported (which is all Steam's own
 * files use) — no arrays, no typed values.
 */

export type VdfNode = { [key: string]: string | VdfNode }

/**
 * Tokenizes and parses a VDF string into a nested object.
 * Duplicate sibling keys (e.g. multiple numbered library folder entries) are
 * preserved by suffixing them, since JS objects can't hold duplicate keys —
 * callers that need order/duplicates should prefer `parseLibraryFolders` below,
 * which flattens straight to the values it needs.
 */
export function parseVdf(text: string): VdfNode {
  let i = 0
  const n = text.length

  function skipWhitespaceAndComments(): void {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++
      if (text[i] === '/' && text[i + 1] === '/') {
        while (i < n && text[i] !== '\n') i++
        continue
      }
      break
    }
  }

  function readQuotedString(): string {
    // assumes text[i] === '"'
    i++ // consume opening quote
    let out = ''
    while (i < n && text[i] !== '"') {
      if (text[i] === '\\' && i + 1 < n) {
        out += text[i + 1]
        i += 2
      } else {
        out += text[i]
        i++
      }
    }
    i++ // consume closing quote
    return out
  }

  function readBareToken(): string {
    let out = ''
    while (i < n && !/\s/.test(text[i]) && text[i] !== '{' && text[i] !== '}') {
      out += text[i]
      i++
    }
    return out
  }

  function readToken(): string {
    skipWhitespaceAndComments()
    if (text[i] === '"') return readQuotedString()
    return readBareToken()
  }

  function parseObject(): VdfNode {
    const obj: VdfNode = {}
    for (;;) {
      skipWhitespaceAndComments()
      if (i >= n || text[i] === '}') {
        if (text[i] === '}') i++
        break
      }
      const key = readToken()
      skipWhitespaceAndComments()
      if (text[i] === '{') {
        i++
        const child = parseObject()
        obj[dedupeKey(obj, key)] = child
      } else {
        const value = readToken()
        obj[dedupeKey(obj, key)] = value
      }
    }
    return obj
  }

  function dedupeKey(obj: VdfNode, key: string): string {
    if (!(key in obj)) return key
    let suffix = 1
    while (`${key}#${suffix}` in obj) suffix++
    return `${key}#${suffix}`
  }

  skipWhitespaceAndComments()
  return parseObject()
}

/**
 * Extracts every library folder path from a parsed `libraryfolders.vdf` document.
 * Each entry's path may sit either directly on the value or under a nested `path` key,
 * depending on the Steam client version that wrote the file.
 */
export function extractLibraryFolderPaths(vdfText: string): string[] {
  const parsed = parseVdf(vdfText)
  const root = parsed['libraryfolders']
  if (!root || typeof root === 'string') return []

  const paths: string[] = []
  for (const value of Object.values(root)) {
    if (typeof value === 'string') {
      paths.push(value)
    } else if (value && typeof value === 'object' && typeof value['path'] === 'string') {
      paths.push(value['path'])
    }
  }
  return paths
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
