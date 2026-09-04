import { useLibraryStore } from '@renderer/store/libraryStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useUpdateStore } from '@renderer/store/updateStore'
import { useUiStore } from '@renderer/store/uiStore'
import bannerUrl from '@renderer/assets/banner.webp'

/**
 * The strip height tracks the window width instead of being a fixed pixel value, so the
 * banner's crop stays proportionally the same at every window size. The art is 2288x448
 * (~5.1:1), so `object-cover` always renders it at ~19.6% of the container width; a fixed
 * height therefore squeezes the art into an ever-thinner slice as the window widens (the
 * old fixed 200px strip had this bug too). Taking a fixed *fraction* of the width instead
 * keeps a constant ~84% of the art in frame.
 *
 * The banner is authored so everything that matters lives in its top ~66%: horn tips at
 * ~1%, wordmark letterforms ending ~40% with drips to ~52%, and the character bottoming
 * out at ~66%. Below that is deliberately empty cracked ground — that band is the lane the
 * control row sits on, so covering it costs nothing.
 *
 * At 16.4vw the wordmark clears the 46px control row with room to spare at the default
 * 1100px width (drips land ~107px down, the row starts at 134px), and the character is
 * fully in frame. The floor for merely keeping the wordmark clear is ~14.5vw, so there is
 * headroom to go shorter if the header ever needs to shrink further. Clamped at both ends
 * so it still fits the 950px minimum window width and stops growing on wide monitors.
 */
const STRIP_HEIGHT = 'clamp(164px, 16.4vw, 232px)'

/**
 * Anchored to the top because the banner's only expendable region is the empty ground at
 * its bottom: cropping from anywhere else clips the horn tips, which sit ~1% down. Every
 * pixel `object-cover` discards should come off the bottom.
 */
const BANNER_FOCUS = 'center top'

/** Shared chrome for the controls floating on the art: readable on their own, but glassy
 *  enough that the artwork still shows through instead of sitting behind a solid bar. */
const FLOATING =
  'border border-white/10 bg-bg-input/80 shadow-lg shadow-black/40 backdrop-blur-md'

export default function Header(): React.JSX.Element {
  const { search, setSearch, viewMode, setViewMode } = useLibraryStore()
  const { settings, openSettings, setViewMode: persistViewMode } = useSettingsStore()
  const updateResult = useUpdateStore((s) => s.result)
  const openAbout = useUiStore((s) => s.openAbout)

  function changeViewMode(mode: 'list' | 'grid'): void {
    setViewMode(mode)
    void persistViewMode(mode)
  }

  return (
    /* The banner art *is* the header: the controls float over its lower band on a gradient
       scrim rather than sitting in a panel below it, which keeps the whole header to the
       height of the artwork. Database/version details moved into the About dialog — at the
       950px minimum window width they could not share a row with the search field. */
    <header
      className="relative shrink-0 overflow-hidden border-b border-bg-card/60 bg-[#06050b]"
      style={{ height: STRIP_HEIGHT }}
    >
      {/* Banner artwork carries the wordmark, so the app title is screen-reader only. */}
      <h1 className="sr-only">Umbra Game Patcher</h1>
      <img
        src={bannerUrl}
        alt="Umbra"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: BANNER_FOCUS }}
      />

      {/* Scrim under the control row. Black rather than the old bg-dark blue so it reads as
          the art darkening into shadow instead of a panel creeping back in. Kept light and
          long rather than short and opaque: the controls carry their own backgrounds, so
          this only has to seat them — a heavier scrim cuts the wordmark mid-stroke. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[92px] bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* Alerts ride the upper-left corner, which is empty smoke in the artwork. Both are
          conditional, so the corner is usually bare. */}
      {(settings.betaAutoInstall || updateResult?.available) && (
        <div className="absolute left-5 top-4 flex items-center gap-2">
          {settings.betaAutoInstall && (
            <span className="rounded-full border border-danger/50 bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-hover backdrop-blur-sm">
              Beta Auto-Install on
            </span>
          )}
          {updateResult?.available && (
            <button
              type="button"
              onClick={() => void window.patcher.openExternal(updateResult.url)}
              title="Open the release on GitHub"
              className="rounded-full border border-accent/50 bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-accent backdrop-blur-sm hover:bg-accent-dim/60 hover:text-text-bright"
            >
              🔔 v{updateResult.latestVersion} available
            </button>
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 px-5 pb-3">
        {/* The row floats, but the input itself stays near-opaque — typed text over the
            artwork is the one thing here that has to stay unambiguously readable. */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your games…"
          className={`min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm text-text-bright placeholder:text-text-dim focus:border-accent focus:outline-none ${FLOATING}`}
        />
        <div className={`flex shrink-0 overflow-hidden rounded-md ${FLOATING}`}>
          <button
            type="button"
            onClick={() => changeViewMode('list')}
            className={`px-3 py-1.5 text-sm ${
              viewMode === 'list'
                ? 'bg-accent-dim text-text-bright'
                : 'text-text-dim hover:text-text'
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => changeViewMode('grid')}
            className={`px-3 py-1.5 text-sm ${
              viewMode === 'grid'
                ? 'bg-accent-dim text-text-bright'
                : 'text-text-dim hover:text-text'
            }`}
          >
            Grid
          </button>
        </div>
        <button
          type="button"
          onClick={openAbout}
          title="About, and database status"
          className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm text-text hover:text-text-bright ${FLOATING}`}
        >
          ℹ
        </button>
        <button
          type="button"
          onClick={openSettings}
          title="Settings"
          className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm text-text hover:text-text-bright ${FLOATING}`}
        >
          ⚙
        </button>
      </div>
    </header>
  )
}
