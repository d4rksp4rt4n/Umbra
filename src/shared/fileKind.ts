/**
 * File types the patch-selection UI renders as "viewable" (opens the in-app document
 * viewer) rather than "downloadable" (a patch archive).
 */
const VIEWABLE_EXTENSIONS = ['.txt', '.docx', '.pdf'] as const

export function isViewableInstructionFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return VIEWABLE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function isExecutablePatch(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.exe')
}

/** Counts only real patch files (archives/exes), excluding instructions/readmes —
 *  used anywhere a "N files" count is shown so it reflects what's actually installable. */
export function countPatchFiles(files: { name: string }[]): number {
  return files.filter((f) => !isViewableInstructionFile(f.name)).length
}
