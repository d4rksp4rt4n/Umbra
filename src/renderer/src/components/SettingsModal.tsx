import { useState } from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { PATCH_SOURCE_LABEL } from '@shared/constants'

function ToggleSwitch({
  checked,
  onChange,
  activeColor = 'bg-danger'
}: {
  checked: boolean
  onChange: () => void
  activeColor?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? activeColor : 'bg-bg-card'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function SettingsModal(): React.JSX.Element | null {
  const {
    settings,
    settingsOpen,
    cacheDirPath,
    closeSettings,
    setBetaAutoInstall,
    setAutoInstallAfterDownload,
    chooseCacheDir,
    resetCacheDir
  } = useSettingsStore()
  const [clearing, setClearing] = useState(false)
  const [clearedMsg, setClearedMsg] = useState<string | null>(null)

  if (!settingsOpen) return null

  async function handleClearCache(): Promise<void> {
    setClearing(true)
    setClearedMsg(null)
    try {
      const { deleted } = await window.patcher.clearCache()
      setClearedMsg(`Removed ${deleted} item(s) from the cache.`)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={closeSettings}
    >
      <div
        className="w-[520px] rounded-lg border border-bg-card bg-bg-dark p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-bright">Settings</h2>
          <button
            type="button"
            onClick={closeSettings}
            className="text-text-dim hover:text-text-bright"
          >
            ✕
          </button>
        </div>

        <div className="rounded-md border border-bg-card bg-bg-input p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-text-bright">
                Enable Beta Auto-Install <span className="text-warn">(experimental)</span>
              </p>
              <p className="mt-1 text-xs text-text-dim">
                When off (default), archive patches are only downloaded — this app opens the
                game folder and the download for you to apply manually. Self-extracting .exe
                patches always have an "Install patch" option, since there's no manual
                alternative for those; you'll always get a confirmation dialog before one runs.
              </p>
              <p className="mt-2 text-xs text-warn">
                When on, archives also get an "Install patch" option that extracts and
                overwrites/adds files directly inside your game folder. You'll still get a
                confirmation dialog naming the exact game and archive before anything runs —
                read it carefully. Patches come from {PATCH_SOURCE_LABEL}, not Steam directly.
              </p>
            </div>
            <ToggleSwitch
              checked={settings.betaAutoInstall}
              onChange={() => void setBetaAutoInstall(!settings.betaAutoInstall)}
            />
          </div>

          {settings.betaAutoInstall && (
            <div className="mt-4 flex items-start justify-between gap-4 border-t border-bg-card pt-4">
              <div>
                <p className="font-semibold text-text-bright">
                  Attempt to auto-install patches after downloading them
                </p>
                <p className="mt-1 text-xs text-text-dim">
                  When on, using "Open patch file" also runs the install step right after the
                  download finishes (archive auto-extract / .exe auto-run), instead of leaving
                  "Install patch" as a separate click. The confirmation dialog before anything
                  actually runs still always appears.
                </p>
              </div>
              <ToggleSwitch
                checked={settings.autoInstallAfterDownload}
                onChange={() => void setAutoInstallAfterDownload(!settings.autoInstallAfterDownload)}
                activeColor="bg-accent-dim"
              />
            </div>
          )}
        </div>

        <div className="mt-4 rounded-md border border-bg-card bg-bg-input p-4">
          <p className="mb-2 font-semibold text-text-bright">Downloaded patch cache</p>
          <p className="mb-2 break-all font-mono text-[11px] text-text-dim">{cacheDirPath}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void window.patcher.openCacheFolder()}
              className="rounded-md border border-bg-card px-3 py-1.5 text-xs text-text hover:bg-bg-card"
            >
              Open cache folder
            </button>
            <button
              type="button"
              onClick={() => void chooseCacheDir()}
              className="rounded-md border border-bg-card px-3 py-1.5 text-xs text-text hover:bg-bg-card"
            >
              Change location…
            </button>
            {settings.cacheDirOverride && (
              <button
                type="button"
                onClick={() => void resetCacheDir()}
                className="rounded-md border border-bg-card px-3 py-1.5 text-xs text-text-dim hover:bg-bg-card"
              >
                Reset to default
              </button>
            )}
            <button
              type="button"
              disabled={clearing}
              onClick={() => void handleClearCache()}
              className="rounded-md border border-danger px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              {clearing ? 'Clearing…' : 'Clear all downloads'}
            </button>
            {clearedMsg && <span className="text-xs text-text-dim">{clearedMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
