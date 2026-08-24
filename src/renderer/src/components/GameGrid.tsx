import { hasUpdate, useLibraryStore } from '@renderer/store/libraryStore'
import { countPatchFiles } from '@shared/fileKind'
import BoxArt from './BoxArt'
import FavoriteStar from './FavoriteStar'
import UpdateBadge from './UpdateBadge'

export default function GameGrid(): React.JSX.Element {
  const { matches, search, favorites, lastApplied, selectedAppid, selectGame, toggleFavorite } =
    useLibraryStore()

  const filtered = matches.filter((m) =>
    m.gameName.toLowerCase().includes(search.trim().toLowerCase())
  )

  if (filtered.length === 0) {
    return <p className="p-6 text-sm text-text-dim">No games match your search.</p>
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 p-4">
      {filtered.map((m) => {
        const isFav = favorites.has(m.appid)
        const isUpd = hasUpdate(m, lastApplied)
        const selected = selectedAppid === m.appid
        return (
          <button
            key={m.appid}
            type="button"
            onClick={() => selectGame(m.appid)}
            className={`group relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors ${
              selected ? 'border-accent bg-bg-card' : 'border-transparent bg-bg-dark hover:bg-bg-card/60'
            }`}
          >
            <div className="relative">
              <BoxArt appid={m.appid} gameName={m.gameName} className="aspect-[2/3] w-full" />
              <div className="absolute right-1.5 top-1.5 rounded-full bg-bg-darkest/70 p-1">
                <FavoriteStar active={isFav} onToggle={() => void toggleFavorite(m.appid)} />
              </div>
              {isUpd && (
                <div className="absolute bottom-1.5 left-1.5">
                  <UpdateBadge />
                </div>
              )}
            </div>
            <div className="px-2 py-1.5">
              <div
                className={`line-clamp-2 text-xs font-medium leading-tight ${isFav ? 'text-fav-gold' : 'text-text'}`}
                title={m.gameName}
              >
                {m.gameName}
              </div>
              <div className="truncate text-[11px] text-text-dim">
                {countPatchFiles(m.data.files)} file(s)
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
