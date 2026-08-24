import { useEffect } from 'react'
import { useLibraryStore } from '@renderer/store/libraryStore'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useCacheStore } from '@renderer/store/cacheStore'
import { useUpdateStore } from '@renderer/store/updateStore'
import Header from '@renderer/components/Header'
import GameList from '@renderer/components/GameList'
import GameGrid from '@renderer/components/GameGrid'
import GameDetail from '@renderer/components/GameDetail'
import SettingsModal from '@renderer/components/SettingsModal'
import AboutModal from '@renderer/components/AboutModal'

/**
 * Top-level layout: header (title/search/view toggle) + a two-pane body, with a list/grid
 * of games on the left and the selected game's detail + patch actions on the right.
 */
export default function App(): React.JSX.Element {
  const { loading, error, viewMode, setLibrary, setLoading, setViewMode } = useLibraryStore()
  const loadSettings = useSettingsStore((s) => s.load)
  const refreshCache = useCacheStore((s) => s.refresh)
  const checkForUpdate = useUpdateStore((s) => s.check)

  useEffect(() => {
    setLoading(true)
    void refreshCache()
    void checkForUpdate()
    loadSettings().then(() => {
      // Apply the persisted list/grid choice once settings are in, without re-persisting
      // it right back (this is a load, not a user click).
      setViewMode(useSettingsStore.getState().settings.viewMode)
    })
    window.patcher
      .loadLibrary()
      .then((result) => setLibrary(result))
      .catch((err) =>
        setLibrary({
          steamPath: null,
          installed: {},
          dbVersion: 'Unknown',
          dbUpdated: false,
          matches: [],
          groupedChanges: {},
          favorites: [],
          lastApplied: {},
          error: String(err)
        })
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-text-dim">
        Scanning Steam library and checking for patches…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-center">
        <p className="text-danger">{error}</p>
        <p className="text-xs text-text-dim">
          Check your Steam installation and internet connection, then restart the app.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <div className="w-[420px] shrink-0 overflow-y-auto border-r border-bg-card">
          {viewMode === 'list' ? <GameList /> : <GameGrid />}
        </div>
        <div className="min-w-0 flex-1">
          <GameDetail />
        </div>
      </div>
      <SettingsModal />
      <AboutModal />
    </div>
  )
}
