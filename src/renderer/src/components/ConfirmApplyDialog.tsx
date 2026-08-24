import { PATCH_SOURCE_LABEL } from '@shared/constants'

interface ConfirmApplyDialogProps {
  gameName: string
  installDir: string
  fileNames: string[]
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The mandatory second confirmation before anything is written into a game folder or a
 * downloaded .exe is executed. It names the exact game, install path, and files about to
 * be written/run, and is confirmed only by an explicit button click (no Enter-to-confirm,
 * no click-outside-to-confirm) so it can't be dismissed on autopilot.
 */
export default function ConfirmApplyDialog({
  gameName,
  installDir,
  fileNames,
  onConfirm,
  onCancel
}: ConfirmApplyDialogProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[520px] rounded-lg border border-danger bg-bg-dark p-5 shadow-xl">
        <h2 className="text-lg font-bold text-danger">Confirm Beta Auto-Install</h2>
        <p className="mt-2 text-sm text-text">
          This will extract and/or silently run downloaded files, then write directly into:
        </p>
        <p className="mt-1 break-all rounded bg-bg-input px-2 py-1.5 font-mono text-xs text-accent">
          {installDir}
        </p>
        <p className="mt-3 text-sm text-text">for <strong>{gameName}</strong>, applying:</p>
        <ul className="mt-1 max-h-32 list-disc overflow-y-auto rounded bg-bg-input px-6 py-2 text-xs text-text">
          {fileNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-warn">
          These files come from {PATCH_SOURCE_LABEL}, not Steam directly. It's not official
          Steam content, so double-check the file list above is what you expect before continuing.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-bg-card px-4 py-1.5 text-sm text-text hover:bg-bg-card"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-danger px-4 py-1.5 text-sm font-semibold text-white hover:bg-danger-hover"
          >
            Run and apply
          </button>
        </div>
      </div>
    </div>
  )
}
