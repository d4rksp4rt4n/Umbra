import { useEffect, useState } from 'react'
import type { GameMatch } from '@shared/types'
import { isViewableInstructionFile, isExecutablePatch } from '@shared/fileKind'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { usePatchStore } from '@renderer/store/patchStore'
import { useLibraryStore } from '@renderer/store/libraryStore'
import { useCacheStore } from '@renderer/store/cacheStore'
import ConfirmApplyDialog from './ConfirmApplyDialog'
import InstructionViewerModal from './InstructionViewerModal'

interface PatchActionPanelProps {
  match: GameMatch
}

export default function PatchActionPanel({ match }: PatchActionPanelProps): React.JSX.Element {
  const { settings } = useSettingsStore()
  const installed = useLibraryStore((s) => s.installed)
  const updateLastApplied = useLibraryStore((s) => s.updateLastApplied)
  const { cachedFileNames, refresh: refreshCache } = useCacheStore()
  const {
    applying,
    activeIndex,
    status,
    percent,
    result,
    confirmTarget,
    resetForGame,
    setApplying,
    setProgress,
    setResult,
    openConfirm,
    closeConfirm
  } = usePatchStore()

  const [viewingIdx, setViewingIdx] = useState<number | null>(null)
  const [viewerFile, setViewerFile] = useState<{ name: string; path: string } | null>(null)

  useEffect(() => {
    resetForGame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.appid])

  useEffect(() => {
    return window.patcher.onPatchProgress((p) => setProgress(p.status, p.percent, p.speed))
  }, [setProgress])

  const instructionFiles = match.data.files
    .map((f, idx) => ({ f, idx }))
    .filter(({ f }) => isViewableInstructionFile(f.name))
  const patchFiles = match.data.files
    .map((f, idx) => ({ f, idx }))
    .filter(({ f }) => !isViewableInstructionFile(f.name))

  async function runPatchAction(
    idx: number,
    opts: { forceDownloadOnly?: boolean; forceApply?: boolean }
  ) {
    setApplying(true, idx)
    setResult(null)
    try {
      const res = await window.patcher.applyPatch({
        appid: match.appid,
        gameName: match.gameName,
        files: match.data.files,
        selectedIndices: [idx],
        ...opts
      })
      setResult(res)
      void refreshCache()
      if (res.ok && res.mode === 'beta' && res.appliedFile) {
        updateLastApplied(match.appid, match.gameName, {
          file: res.appliedFile,
          date: new Date().toISOString().slice(0, 10),
          changes: res.changes ?? { overwritten: [], added: [], skipped: null }
        })
      }
      return res
    } finally {
      setApplying(false, null)
    }
  }

  async function handleOpenPatchFile(idx: number): Promise<void> {
    const file = match.data.files[idx]
    const alreadyCached = cachedFileNames.has(file.name)

    // First click on an undownloaded file: only download it — do NOT open it. The
    // button relabels itself to "Open patch file" once it's cached (see isCached below),
    // and only a follow-up click on that actually opens it. obtainFile() short-circuits
    // instantly for an already-cached, valid file, so this same action is cheap to reuse
    // for the "open" click too, no separate code path needed.
    const res = await runPatchAction(idx, { forceDownloadOnly: true })

    if (alreadyCached && res.ok && res.cachedPaths[0]) {
      await window.patcher.openPath(res.cachedPaths[0])
    }
    if (!alreadyCached && res.ok && settings.betaAutoInstall && settings.autoInstallAfterDownload) {
      // Chains into the apply step automatically, but still stops at the confirmation
      // dialog rather than skipping it — the auto-install setting removes the need for a
      // separate "Install patch" click, not the explicit confirm-before-writing step.
      openConfirm(idx)
    }
  }

  async function handleConfirmedApply(): Promise<void> {
    const idx = confirmTarget
    closeConfirm()
    if (idx == null) return
    await runPatchAction(idx, { forceApply: true })
  }

  async function viewInstructions(idx: number): Promise<void> {
    setViewingIdx(idx)
    try {
      const file = match.data.files[idx]
      const res = await runPatchAction(idx, { forceDownloadOnly: true })
      if (res.ok && res.cachedPaths[0]) {
        setViewerFile({ name: file.name, path: res.cachedPaths[0] })
      }
    } finally {
      setViewingIdx(null)
    }
  }

  const confirmFile = confirmTarget != null ? match.data.files[confirmTarget] : null

  return (
    <div>
      <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-text-dim">
        Instructions
      </h3>
      {instructionFiles.length === 0 ? (
        <p className="text-sm text-text-dim">None provided for this game.</p>
      ) : (
        <ul className="mb-4 divide-y divide-bg-card overflow-hidden rounded-md border border-bg-card">
          {instructionFiles.map(({ f, idx }) => (
            <li key={f.path} className="flex items-center gap-3 bg-bg-dark px-3 py-2">
              <span className="text-lg">📖</span>
              <span className="min-w-0 flex-1 truncate text-sm text-viewable">{f.name}</span>
              <button
                type="button"
                disabled={viewingIdx === idx}
                onClick={() => void viewInstructions(idx)}
                className="shrink-0 rounded-md border border-viewable px-2 py-1 text-xs text-viewable hover:bg-viewable/10 disabled:opacity-50"
              >
                {viewingIdx === idx ? 'Opening…' : 'View'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">
        Patch files ({patchFiles.length})
      </h3>
      {patchFiles.length === 0 ? (
        <p className="text-sm text-text-dim">No downloadable patch files listed.</p>
      ) : (
        <ul className="divide-y divide-bg-card overflow-hidden rounded-md border border-bg-card">
          {patchFiles.map(({ f, idx }) => {
            const isExe = isExecutablePatch(f.name)
            const isCached = cachedFileNames.has(f.name)
            const isBusy = applying && activeIndex === idx
            const showInstall = isExe || settings.betaAutoInstall

            return (
              <li
                key={f.path}
                className="flex items-center gap-3 bg-bg-dark px-3 py-2 hover:bg-bg-card/50"
              >
                <span className="text-lg">{isExe ? '⚙️' : '📦'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text">{f.name}</div>
                  <div className="truncate text-xs text-text-dim">
                    {f.size}
                    {isCached && <span className="ml-2 text-accent">· cached</span>}
                  </div>
                </div>

                {!isExe && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleOpenPatchFile(idx)}
                    className="shrink-0 rounded-md border border-bg-card px-2 py-1 text-xs text-text hover:bg-bg-card disabled:opacity-50"
                  >
                    {isBusy ? 'Working…' : isCached ? 'Open patch file' : 'Download patch file'}
                  </button>
                )}
                {showInstall && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => openConfirm(idx)}
                    className="shrink-0 rounded-md bg-accent-dim px-2 py-1 text-xs font-semibold text-text-bright hover:bg-accent disabled:opacity-50"
                  >
                    {isBusy ? 'Working…' : 'Install patch'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {applying && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg-input">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: percent >= 0 ? `${percent}%` : '30%' }}
            />
          </div>
          <p className="mt-1 text-xs text-text-dim">{status || 'Working…'}</p>
        </div>
      )}

      {result && !applying && (
        <div className="mt-3 rounded-md border border-bg-card bg-bg-input p-3 text-sm">
          {result.ok ? (
            <>
              <p className="text-success">
                {result.mode === 'beta'
                  ? `Applied: ${result.appliedFile ?? 'files'}`
                  : `Downloaded to your cache folder.`}
              </p>
              {result.mode === 'beta' && result.changes && (
                <div className="mt-2 space-y-1 text-xs">
                  {result.changes.overwritten.length > 0 && (
                    <p className="text-accent">
                      {result.changes.overwritten.length} file(s) overwritten
                    </p>
                  )}
                  {result.changes.added.length > 0 && (
                    <p className="text-success">{result.changes.added.length} file(s) added</p>
                  )}
                  {result.changes.skipped && result.changes.skipped.length > 0 && (
                    <p className="text-warn">
                      {result.changes.skipped.length} file(s) skipped (ambiguous match)
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-danger">{result.error}</p>
          )}
        </div>
      )}

      {confirmFile && (
        <ConfirmApplyDialog
          gameName={match.gameName}
          installDir={installed[match.appid]?.installDir ?? 'Unknown install directory'}
          fileNames={[confirmFile.name]}
          onCancel={closeConfirm}
          onConfirm={() => void handleConfirmedApply()}
        />
      )}

      {viewerFile && (
        <InstructionViewerModal
          fileName={viewerFile.name}
          filePath={viewerFile.path}
          onClose={() => setViewerFile(null)}
        />
      )}
    </div>
  )
}
