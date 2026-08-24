/**
 * Just enough version comparison for update checking — not a full semver implementation
 * (no build-metadata precedence rules, no prerelease ordering), since all we need is
 * "is the GitHub release's tag newer than what's running". Tolerates a leading 'v'
 * (GitHub tags are usually "v2.1.0") and a trailing "-something" suffix (our own
 * APP_VERSION is "2.0.0-electron").
 */
function parseVersion(raw: string): [number, number, number] {
  const cleaned = raw.trim().replace(/^v/i, '').split('-')[0]
  const [major, minor, patch] = cleaned.split('.').map((n) => parseInt(n, 10) || 0)
  return [major ?? 0, minor ?? 0, patch ?? 0]
}

/** True if `candidate` is a strictly newer version than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const [cMaj, cMin, cPatch] = parseVersion(candidate)
  const [curMaj, curMin, curPatch] = parseVersion(current)

  if (cMaj !== curMaj) return cMaj > curMaj
  if (cMin !== curMin) return cMin > curMin
  return cPatch > curPatch
}
