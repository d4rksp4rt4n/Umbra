/**
 * Normalizes a DB entry's `contents` field into a flat file list.
 *
 * The remote database has gone through two shapes over time:
 *   - legacy: nested dict of { [name]: { type: "file"|"folder", children?, id, size, ... } }
 *   - current: flat list of items, each with a "name"/"filename" + "id"; type can be
 *              anything (".exe", ".zip", "file", null...) so we don't filter on it —
 *              any item with an id is accepted regardless of its type.
 *
 * Both shapes flatten to the same PatchFile[] the UI/download pipeline expects.
 */
import type { PatchFile } from '@shared/types'

type LegacyContentsNode = {
  [name: string]: {
    type?: string
    id?: string
    mimeType?: string
    size?: string | number
    children?: LegacyContentsNode | FlatContentsItem[]
  }
}

type FlatContentsItem = {
  name?: string
  filename?: string
  id?: string
  mimeType?: string
  size?: string | number
  raw_size?: string | number
  type?: string
  children?: LegacyContentsNode | FlatContentsItem[]
}

export function flattenGameContents(contents: unknown): PatchFile[] {
  const flatFiles: PatchFile[] = []

  function recurse(items: unknown, currentPath: string): void {
    if (items && typeof items === 'object' && !Array.isArray(items)) {
      // Legacy nested dict format.
      const node = items as LegacyContentsNode
      for (const [itemName, itemData] of Object.entries(node)) {
        if (!itemData || typeof itemData !== 'object') continue
        if (itemData.type === 'file') {
          const displayPath = currentPath ? `${currentPath}/${itemName}` : itemName
          flatFiles.push({
            name: itemName,
            path: displayPath,
            id: itemData.id ?? null,
            mimeType: itemData.mimeType ?? null,
            size: itemData.size != null ? String(itemData.size) : 'Unknown'
          })
        } else if (itemData.type === 'folder' && itemData.children) {
          const newPath = currentPath ? `${currentPath}/${itemName}` : itemName
          recurse(itemData.children, newPath)
        }
      }
    } else if (Array.isArray(items)) {
      // Current flat list format.
      for (const itemData of items as FlatContentsItem[]) {
        if (!itemData || typeof itemData !== 'object') continue

        const itemName = itemData.name ?? itemData.filename
        if (!itemName || !itemData.id) continue

        const displayPath = currentPath ? `${currentPath}/${itemName}` : itemName
        flatFiles.push({
          name: itemName,
          path: displayPath,
          id: itemData.id,
          mimeType: itemData.mimeType ?? null,
          size:
            itemData.size != null
              ? String(itemData.size)
              : itemData.raw_size != null
                ? String(itemData.raw_size)
                : 'Unknown'
        })

        if (itemData.type === 'folder' && itemData.children) {
          const newPath = currentPath ? `${currentPath}/${itemName}` : itemName
          recurse(itemData.children, newPath)
        }
      }
    }
  }

  if (contents) recurse(contents, '')

  flatFiles.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  return flatFiles
}
