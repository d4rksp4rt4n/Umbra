import { hasUpdate, useLibraryStore } from '@renderer/store/libraryStore'
import BoxArt from './BoxArt'
import FavoriteStar from './FavoriteStar'
import UpdateBadge from './UpdateBadge'
import PatchActionPanel from './PatchActionPanel'

export default function GameDetail(): React.JSX.Element {
  const { matches, selectedAppid, favorites, lastApplied, installed, toggleFavorite } =
    useLibraryStore()
  const match = matches.find((m) => m.appid === selectedAppid)

  if (!match) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-text-dim">
        Select a game to see its available patches.
      </div>
    )
  }

  const isFav = favorites.has(match.appid)
  const isUpd = hasUpdate(match, lastApplied)
  const lastPatch = lastApplied[match.appid]?.[match.gameName]
  const installDir = installed[match.appid]?.installDir ?? null

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <div className="flex gap-4">
        <BoxArt
          appid={match.appid}
          gameName={match.gameName}
          className="h-[270px] w-[180px] shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className={`text-xl font-bold ${isFav ? 'text-fav-gold' : 'text-text-bright'}`}>
              {match.gameName}
            </h2>
            <FavoriteStar active={isFav} onToggle={() => void toggleFavorite(match.appid)} size="md" />
          </div>
          <p className="mt-0.5 text-sm text-text-dim">by {match.devName}</p>
          <p className="mt-0.5 text-xs text-text-dim">App ID {match.appid}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isUpd && <UpdateBadge />}
            {lastPatch && (
              <span className="rounded-full bg-bg-input px-2 py-0.5 text-[11px] text-text-dim">
                Last applied: {lastPatch.file} · {lastPatch.date}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void window.patcher.openExternal(`steam://run/${match.appid}`)}
              className="rounded-md bg-accent-dim px-3 py-1.5 text-xs font-semibold text-text-bright hover:bg-accent"
            >
              ▶ Launch game
            </button>
            {installDir && (
              <button
                type="button"
                onClick={() => void window.patcher.openPath(installDir)}
                className="rounded-md border border-bg-card px-3 py-1.5 text-xs text-text hover:bg-bg-card"
              >
                📁 Open game folder
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                void window.patcher.openExternal(
                  `https://store.steampowered.com/app/${match.appid}`
                )
              }
              className="rounded-md border border-bg-card px-3 py-1.5 text-xs text-text hover:bg-bg-card"
            >
              Steam page
            </button>
          </div>
        </div>
      </div>

      {lastPatch?.changes && (
        <div className="mt-4 rounded-md border border-bg-card bg-bg-input p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Last install changes
          </p>
          <div className="space-y-1 text-xs">
            {lastPatch.changes.overwritten.length > 0 && (
              <details>
                <summary className="cursor-pointer text-accent">
                  {lastPatch.changes.overwritten.length} file(s) overwritten
                </summary>
                <ul className="ml-4 mt-1 list-disc text-text-dim">
                  {lastPatch.changes.overwritten.map((f) => (
                    <li key={f} className="break-all">
                      {f}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {lastPatch.changes.added.length > 0 && (
              <details>
                <summary className="cursor-pointer text-success">
                  {lastPatch.changes.added.length} file(s) added
                </summary>
                <ul className="ml-4 mt-1 list-disc text-text-dim">
                  {lastPatch.changes.added.map((f) => (
                    <li key={f} className="break-all">
                      {f}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {lastPatch.changes.skipped && lastPatch.changes.skipped.length > 0 && (
              <details>
                <summary className="cursor-pointer text-warn">
                  {lastPatch.changes.skipped.length} file(s) skipped (ambiguous match)
                </summary>
                <ul className="ml-4 mt-1 list-disc text-text-dim">
                  {lastPatch.changes.skipped.map((f) => (
                    <li key={f} className="break-all">
                      {f}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}

      {/* key= forces a clean remount per game so selection/progress state from PatchActionPanel
          (and its child usePatchStore) never bleeds between different games' file lists. */}
      <PatchActionPanel key={match.appid} match={match} />
    </div>
  )
}
