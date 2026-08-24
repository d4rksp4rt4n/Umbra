import { hasUpdate, useLibraryStore } from '@renderer/store/libraryStore'
import { countPatchFiles } from '@shared/fileKind'
import BoxArt from './BoxArt'
import FavoriteStar from './FavoriteStar'
import UpdateBadge from './UpdateBadge'

/**
 * Compact row-based list view: box art thumbnail, favorite star, dev name, file count,
 * and an update badge when a newer patch is available.
 */
export default function GameList(): React.JSX.Element {
  const { matches, search, favorites, lastApplied, selectedAppid, selectGame, toggleFavorite } =
    useLibraryStore()

  const filtered = matches.filter((m) =>
    m.gameName.toLowerCase().includes(search.trim().toLowerCase())
  )

  if (filtered.length === 0) {
    return <p className="p-6 text-sm text-text-dim">No games match your search.</p>
  }

  return (
    <ul className="divide-y divide-bg-card">
      {filtered.map((m) => {
        const isFav = favorites.has(m.appid)
        const isUpd = hasUpdate(m, lastApplied)
        const selected = selectedAppid === m.appid
        return (
          <li key={m.appid}>
            <button
              type="button"
              onClick={() => selectGame(m.appid)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                selected ? 'bg-bg-card' : 'hover:bg-bg-card/50'
              }`}
            >
              <BoxArt
                appid={m.appid}
                gameName={m.gameName}
                className="h-10 w-7 shrink-0 rounded-sm"
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`line-clamp-2 text-sm leading-tight ${isFav ? 'text-fav-gold' : 'text-text'}`}
                  title={m.gameName}
                >
                  {m.gameName}
                </div>
                <div className="truncate text-xs text-text-dim">{m.devName}</div>
              </div>
              <span className="shrink-0 text-xs text-text-dim">
                {countPatchFiles(m.data.files)} file(s)
              </span>
              {isUpd && <UpdateBadge />}
              <FavoriteStar active={isFav} onToggle={() => void toggleFavorite(m.appid)} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
