import { APP_VERSION } from '@shared/constants'
import { useLibraryStore } from '@renderer/store/libraryStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useUpdateStore } from '@renderer/store/updateStore'
import { useUiStore } from '@renderer/store/uiStore'
import bannerUrl from '@renderer/assets/banner.webp'

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
    <header className="border-b border-bg-card bg-bg-dark">
      {/* Banner artwork carries the wordmark, so the app title is screen-reader only here.
          The artwork is authored at ~5:1 to match this strip's aspect at typical window
          widths, so object-cover crops only a few pixels off the sides and the logo and
          character always stay fully visible. Controls sit below the art rather than on
          top of it — a scrim dark enough to keep overlaid text legible would swallow the
          letters. */}
      <div className="relative h-[200px] shrink-0 overflow-hidden bg-[#06050b]">
        <h1 className="sr-only">Umbra Game Patcher</h1>
        <img
          src={bannerUrl}
          alt="Umbra"
          className="h-full w-full object-cover"
          style={{ objectPosition: 'center' }}
        />
        {/* Short fade so the art meets the controls instead of ending on a hard edge. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-bg-dark to-transparent" />
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-0">
        <div className="flex items-baseline gap-3">
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
            Database generated {dbVersion} · {dbUpdated ? 'Updated' : 'Up to date'} ·{' '}
            {matches.length} game{matches.length === 1 ? '' : 's'} with patches
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

      <div className="flex items-center gap-3 px-5 py-3">
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
