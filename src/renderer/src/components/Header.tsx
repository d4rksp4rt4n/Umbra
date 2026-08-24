import { APP_VERSION } from '@shared/constants'
import { useLibraryStore } from '@renderer/store/libraryStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useUpdateStore } from '@renderer/store/updateStore'
import { useUiStore } from '@renderer/store/uiStore'

export default function Header(): React.JSX.Element {
  const { dbVersion, dbUpdated, search, setSearch, viewMode, setViewMode, matches } =
    useLibraryStore()
  const { settings, openSettings, setViewMode: persistViewMode } = useSettingsStore()
  const updateResult = useUpdateStore((s) => s.result)
  const openAbout = useUiStore((s) => s.openAbout)

  function changeViewMode(mode: 'list' | 'grid'): void {
    setViewMode(mode)
    void persistViewMode(mode)
  }

  return (
    <header className="flex flex-col gap-3 border-b border-bg-card bg-bg-dark px-5 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-bold text-text-bright">Umbra Game Patcher</h1>
          <span className="text-xs text-text-dim">{APP_VERSION}</span>
          {settings.betaAutoInstall && (
            <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
              Beta Auto-Install on
            </span>
          )}
          {updateResult?.available && (
            <button
              type="button"
              onClick={() => void window.patcher.openExternal(updateResult.url)}
              title="Open the release on GitHub"
              className="rounded-full bg-accent-dim/30 px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent-dim/50"
            >
              🔔 v{updateResult.latestVersion} available
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-dim">
            Database generated {dbVersion} · {dbUpdated ? 'Updated' : 'Up to date'} · {matches.length} game
            {matches.length === 1 ? '' : 's'} with patches
          </span>
          <button
            type="button"
            onClick={openAbout}
            title="About"
            className="rounded-md border border-bg-card px-2 py-1 text-sm text-text-dim hover:bg-bg-card hover:text-text-bright"
          >
            ℹ
          </button>
          <button
            type="button"
            onClick={openSettings}
            title="Settings"
            className="rounded-md border border-bg-card px-2 py-1 text-sm text-text-dim hover:bg-bg-card hover:text-text-bright"
          >
            ⚙
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your games…"
          className="flex-1 rounded-md border border-bg-card bg-bg-input px-3 py-1.5 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
        />
        <div className="flex overflow-hidden rounded-md border border-bg-card">
          <button
            type="button"
            onClick={() => changeViewMode('list')}
            className={`px-3 py-1.5 text-sm ${
              viewMode === 'list' ? 'bg-accent-dim text-text-bright' : 'bg-bg-input text-text-dim'
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => changeViewMode('grid')}
            className={`px-3 py-1.5 text-sm ${
              viewMode === 'grid' ? 'bg-accent-dim text-text-bright' : 'bg-bg-input text-text-dim'
            }`}
          >
            Grid
          </button>
        </div>
      </div>
    </header>
  )
}
