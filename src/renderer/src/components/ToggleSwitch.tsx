/**
 * The settings toggle. Lives in its own module because more than one settings section
 * uses it now; the visual treatment is shared, only the "on" colour varies (red for the
 * destructive Beta Auto-Install switch, blue for everything else).
 */
export default function ToggleSwitch({
  checked,
  onChange,
  activeColor = 'bg-danger',
  label
}: {
  checked: boolean
  onChange: () => void
  activeColor?: string
  /** Accessible name, for switches whose visible label isn't wired up via a <label>. */
  label?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
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
