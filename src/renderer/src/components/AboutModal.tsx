import { APP_VERSION, GITHUB_REPO_URL, NUKIGE_SITE_URL } from '@shared/constants'
import { useUiStore } from '@renderer/store/uiStore'

export default function AboutModal(): React.JSX.Element | null {
  const { aboutOpen, closeAbout } = useUiStore()

  if (!aboutOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={closeAbout}
    >
      <div
        className="w-[420px] rounded-lg border border-bg-card bg-bg-dark p-5 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span />
          <button
            type="button"
            onClick={closeAbout}
            className="text-text-dim hover:text-text-bright"
          >
            ✕
          </button>
        </div>

        <h2 className="text-xl font-bold text-text-bright">Umbra Game Patcher</h2>
        <p className="mt-1 text-sm text-text-dim">Version {APP_VERSION}</p>

        <p className="mt-4 text-sm text-text">
          Content restoration for adult visual novels and eroge on Steam. Detects your
          installed games, cross-references them against a curated patch database, and helps
          you download and apply the ones available for your library.
        </p>

        <p className="mt-3 text-xs text-text-dim">
          Patch data comes from the Nukige Reborn archive.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void window.patcher.openExternal(GITHUB_REPO_URL)}
            className="rounded-md border border-bg-card px-3 py-2 text-sm text-text hover:bg-bg-card"
          >
            View on GitHub
          </button>
          <button
            type="button"
            onClick={() => void window.patcher.openExternal(NUKIGE_SITE_URL)}
            className="rounded-md border border-bg-card px-3 py-2 text-sm text-text hover:bg-bg-card"
          >
            Nukige Reborn
          </button>
        </div>
      </div>
    </div>
  )
}
