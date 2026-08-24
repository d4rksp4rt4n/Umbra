interface FavoriteStarProps {
  active: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
}

export default function FavoriteStar({
  active,
  onToggle,
  size = 'sm'
}: FavoriteStarProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
      className={`leading-none transition-transform hover:scale-110 ${
        size === 'md' ? 'text-2xl' : 'text-base'
      } ${active ? 'text-fav-gold' : 'text-text-dim hover:text-fav-gold'}`}
    >
      {active ? '★' : '☆'}
    </button>
  )
}
