import { useEffect, useState } from 'react'
import type { InstructionContent } from '@shared/types'

interface InstructionViewerModalProps {
  fileName: string
  filePath: string
  onClose: () => void
}

export default function InstructionViewerModal({
  fileName,
  filePath,
  onClose
}: InstructionViewerModalProps): React.JSX.Element {
  const [content, setContent] = useState<InstructionContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    window.patcher.readInstructions(filePath).then((result) => {
      if (!cancelled) {
        setContent(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [filePath])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-lg border border-bg-card bg-bg-dark shadow-xl">
        <div className="flex items-center justify-between border-b border-bg-card px-4 py-3">
          <h3 className="truncate text-sm font-semibold text-text-bright">{fileName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-text-dim hover:text-text-bright"
          >
            ✕
          </button>
        </div>

        <div className="min-h-[200px] overflow-y-auto p-5">
          {loading && <p className="text-sm text-text-dim">Loading…</p>}

          {!loading && content?.kind === 'text' && (
            <pre className="whitespace-pre-wrap font-sans text-sm text-text">{content.content}</pre>
          )}

          {!loading && content?.kind === 'html' && (
            // Content comes from mammoth's DOCX conversion (main process), not from the web —
            // it's rendered structural HTML (headings/paragraphs/tables/images), not
            // arbitrary remote markup, so this is the same trust boundary as the .txt case.
            <div
              className="text-sm leading-relaxed text-text [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-text-bright [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-text-bright [&_p]:my-2 [&_a]:text-link [&_a]:underline [&_img]:max-w-full [&_table]:border-collapse [&_td]:border [&_td]:border-bg-card [&_td]:p-1 [&_th]:border [&_th]:border-bg-card [&_th]:p-1"
              dangerouslySetInnerHTML={{ __html: content.content }}
            />
          )}

          {!loading && content?.kind === 'unsupported' && (
            <div className="text-sm text-text-dim">
              <p>{content.content || "This file type can't be previewed in-app yet."}</p>
              <button
                type="button"
                onClick={() => void window.patcher.openPath(filePath)}
                className="mt-3 rounded-md border border-bg-card px-3 py-1.5 text-xs text-text hover:bg-bg-card"
              >
                Open with default app instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
