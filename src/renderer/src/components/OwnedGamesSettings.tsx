import { useState } from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useLibraryStore } from '@renderer/store/libraryStore'
import { STEAMDB_CALCULATOR_URL, STEAM_USERDATA_URL } from '@shared/constants'
import ToggleSwitch from './ToggleSwitch'

/** ISO timestamp -> "5 Sep 2026, 18:05" in the viewer's own locale and timezone. */
function formatSyncedAt(iso: string | null): string {
  if (!iso) return 'never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const SOURCE_LABEL: Record<string, string> = {
  steamdb: 'SteamDB calculator page',
  'steam-userdata': 'Steam store userdata'
}

/**
 * Settings section for the owned-but-not-installed feature: the toggle itself, plus the
 * import ("sync") controls for the owned-games list that feeds it.
 *
 * The list is imported from a file the user exports rather than fetched, because Steam
 * offers no way to read ownership without a credential — see main/steam/ownedGames.ts
 * for the full reasoning. That is also why there's no auto-sync-on-launch option: with
 * nothing stored to authenticate with, there is nothing to sync *with* unattended.
 */
export default function OwnedGamesSettings(): React.JSX.Element {
  const {
    settings,
    ownedImport,
    importing,
    setShowUninstalled,
    importOwnedGames,
    clearOwnedGames
  } = useSettingsStore()
  const ownedCount = useLibraryStore((s) => s.ownedCount)
  const ownedSyncedAt = useLibraryStore((s) => s.ownedSyncedAt)
  const ownedSource = useLibraryStore((s) => s.ownedSource)
  const uninstalledCount = useLibraryStore((s) => s.uninstalledCount)
  const [showHelp, setShowHelp] = useState(false)

  const hasList = ownedCount > 0

  return (
    <div className="mt-4 rounded-md border border-bg-card bg-bg-input p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-text-bright">
            Show games you own but haven&apos;t installed
          </p>
          <p className="mt-1 text-xs text-text-dim">
            By default the library only covers games installed on this PC. With this on, it
            also lists games from your imported Steam library that have patches available, so
            you can see what&apos;s out there before reinstalling. Those entries are
            download-only — with no game folder on disk there is nothing to apply a patch
            into.
          </p>
        </div>
        <ToggleSwitch
          checked={settings.showUninstalled}
          onChange={() => void setShowUninstalled(!settings.showUninstalled)}
          activeColor="bg-accent-dim"
          label="Show games you own but haven't installed"
        />
      </div>

      <div className="mt-4 border-t border-bg-card pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            Owned games list
          </p>
          <p className="text-[11px] text-text-dim">
            Last synced: {formatSyncedAt(ownedSyncedAt)}
            {ownedSource && SOURCE_LABEL[ownedSource] ? ` · ${SOURCE_LABEL[ownedSource]}` : ''}
          </p>
        </div>

        <p className="mt-1 text-xs text-text-dim">
          {hasList ? (
            <>
              <span className="text-text">{ownedCount.toLocaleString()}</span> owned games
              imported
              {settings.showUninstalled && (
                <>
                  {' · '}
                  <span className="text-accent">{uninstalledCount.toLocaleString()}</span> with
                  patches, not installed
                </>
              )}
            </>
          ) : (
            'Nothing imported yet — the toggle above has nothing to add until you sync.'
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={importing}
            onClick={() => void importOwnedGames()}
            className="rounded-md bg-accent-dim px-3 py-1.5 text-xs font-semibold text-text-bright hover:bg-accent disabled:opacity-50"
          >
            {importing ? 'Syncing…' : hasList ? 'Re-sync…' : 'Sync owned games…'}
          </button>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="rounded-md border border-bg-card px-3 py-1.5 text-xs text-text hover:bg-bg-card"
          >
            {showHelp ? 'Hide steps' : 'How do I get the file?'}
          </button>
          {hasList && (
            <button
              type="button"
              onClick={() => void clearOwnedGames()}
              className="rounded-md border border-bg-card px-3 py-1.5 text-xs text-text-dim hover:bg-bg-card"
            >
              Clear list
            </button>
          )}
        </div>

        {ownedImport && (
          <p className={`mt-2 text-xs ${ownedImport.ok ? 'text-success' : 'text-danger'}`}>
            {ownedImport.ok
              ? `Imported ${ownedImport.parsed.toLocaleString()} owned games.`
              : ownedImport.error}
          </p>
        )}

        {showHelp && (
          <div className="mt-3 space-y-3 rounded-md border border-bg-card bg-bg-dark p-3 text-xs text-text-dim">
            <p>
              Steam has no way to tell an app which games you own without an API key or your
              login, so Umbra asks you to export the list yourself from a page you are
              already signed in to. Only the list of app IDs is stored — no key, no password,
              no session.
            </p>
            <div>
              <p className="font-semibold text-text">From Steam (recommended)</p>
              <ol className="ml-4 mt-1 list-decimal space-y-0.5">
                <li>
                  Signed in to Steam in your browser, open{' '}
                  <button
                    type="button"
                    onClick={() => void window.patcher.openExternal(STEAM_USERDATA_URL)}
                    className="break-all text-link underline hover:text-accent"
                  >
                    {STEAM_USERDATA_URL}
                  </button>
                </li>
                <li>Save the page with Ctrl+S — it&apos;s a small .json file.</li>
                <li>Hit &ldquo;Sync owned games…&rdquo; above and pick it.</li>
              </ol>
              <p className="mt-1 text-[11px]">
                If it looks empty, you were signed out — sign in, reload, and save again.
              </p>
            </div>
            <div>
              <p className="font-semibold text-text">From SteamDB (fallback)</p>
              <ol className="ml-4 mt-1 list-decimal space-y-0.5">
                <li>
                  Open{' '}
                  <button
                    type="button"
                    onClick={() => void window.patcher.openExternal(STEAMDB_CALCULATOR_URL)}
                    className="text-link underline hover:text-accent"
                  >
                    the SteamDB calculator
                  </button>{' '}
                  and look up your own profile.
                </li>
                <li>Wait for the games table to load, then save the page with Ctrl+S.</li>
                <li>Hit &ldquo;Sync owned games…&rdquo; above and pick the saved .htm file.</li>
              </ol>
              <p className="mt-1 text-[11px]">
                Slower — a much larger page, and it needs your profile looked up first. Worth
                keeping for the day the Steam route changes shape.
              </p>
            </div>
            <p>
              The list is a snapshot, so re-sync whenever you buy something you want Umbra to
              notice.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
