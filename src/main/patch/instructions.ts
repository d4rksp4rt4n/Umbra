/**
 * Backs the in-app instructions viewer: `.txt` is read directly and `.docx` is converted
 * to HTML, both rendered inside the app window rather than handed off to the OS. PDF
 * isn't rendered in-app yet — a proper PDF viewer is a much heavier dependency
 * (pdfjs-dist), so PDFs still open via the OS default viewer for now.
 */
import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import mammoth from 'mammoth'
import log from 'electron-log'
import type { InstructionContent } from '@shared/types'

const MAX_TEXT_BYTES = 5 * 1024 * 1024 // 5MB — plenty for a readme, guards against surprises

export async function readInstructionFile(filePath: string): Promise<InstructionContent> {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.txt') {
    const { size } = await stat(filePath)
    if (size > MAX_TEXT_BYTES) {
      return { kind: 'unsupported', content: 'File is too large to preview in-app.' }
    }
    const content = await readFile(filePath, 'utf-8')
    return { kind: 'text', content }
  }

  if (ext === '.docx') {
    try {
      const result = await mammoth.convertToHtml({ path: filePath })
      if (result.messages.length > 0) {
        log.debug(`[patch/instructions] mammoth warnings for ${filePath}:`, result.messages)
      }
      return { kind: 'html', content: result.value }
    } catch (err) {
      log.warn(`[patch/instructions] Failed to convert ${filePath}: ${err}`)
      return { kind: 'unsupported', content: 'Could not render this document.' }
    }
  }

  return { kind: 'unsupported', content: '' }
}
