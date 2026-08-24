import { useState } from 'react'

interface BoxArtProps {
  appid: string
  gameName: string
  className?: string
}

/**
 * Renders a game's cover art via the `boxart://` protocol registered in the main process
 * (see src/main/index.ts + src/main/steam/boxArt.ts). Falls back to a generated
 * placeholder — initials over the Steam dark palette — so there's no bundled fallback
 * image asset to ship, and the placeholder matches the game's own name.
 *
 * The appid goes in the URL *path*, not the host (`boxart://appicon/228980`, not
 * `boxart://228980/...`). `boxart` is registered as a "standard" scheme so `net.fetch`/
 * CORS work, but that also makes Chromium apply special-scheme host-parsing rules — a
 * purely-numeric host gets silently reinterpreted as an IPv4 address (e.g. appid 1023740
 * becomes "0.15.158.252") before the request ever reaches our protocol handler. Paths
 * aren't subject to that coercion, so the appid has to live there instead.
 */
export default function BoxArt({ appid, gameName, className = '' }: BoxArtProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  if (failed) {
    const initials = gameName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('')

    return (
      <div
        className={`flex items-center justify-center bg-bg-input text-text-dim font-bold select-none ${className}`}
        title={gameName}
      >
        <span className="text-2xl">{initials || '?'}</span>
      </div>
    )
  }

  return (
    <img
      src={`boxart://appicon/${appid}`}
      alt={gameName}
      className={`object-cover bg-bg-input ${className}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
