/**
 * Marks a row the owned-but-not-installed feature added. Deliberately muted rather than
 * alarm-coloured: it's a neutral fact about the game, not a problem with it, and these
 * rows already sort below every installed game.
 */
export default function NotInstalledBadge({
  compact = false
}: {
  /** Grid tiles have far less room than list rows, so they get the short form. */
  compact?: boolean
}): React.JSX.Element {
  return (
    <span
      className="shrink-0 rounded-full border border-text-dim/40 bg-bg-darkest/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-dim"
      title="You own this on Steam, but it isn't installed on this PC"
    >
      {compact ? 'Not inst.' : 'Not installed'}
    </span>
  )
}
