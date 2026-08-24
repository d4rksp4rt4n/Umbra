/**
 * The `boxart://` protocol handler needs the resolved Steam path to serve images, but
 * protocol handlers are registered once at startup and take no request-specific context
 * beyond the URL. Rather than re-running Steam discovery on every image request, we cache
 * the path here once `loadLibrary()` resolves it.
 */
let steamPath: string | null = null

export function setSteamPath(path: string | null): void {
  steamPath = path
}

export function getCachedSteamPath(): string | null {
  return steamPath
}
