/**
 * Lightweight update *notification* — not an auto-updater. Deliberately so: this app
 * writes into game folders and runs downloaded .exe patches, both already gated behind
 * explicit confirmation; a background auto-download-and-install of the app itself would
 * sit oddly next to that "nothing happens without you clicking it" posture. Unsigned
 * Windows builds would also still hit SmartScreen on every auto-downloaded installer
 * anyway, undercutting the main benefit of a silent auto-updater. This just checks once
 * and, if a newer release exists, hands the user a link to grab it themselves.
 */
import log from 'electron-log'
import { APP_VERSION, GITHUB_LATEST_RELEASE_API_URL, GITHUB_RELEASES_URL } from '@shared/constants'
import { isNewerVersion } from '@shared/version'
import type { UpdateCheckResult } from '@shared/types'

interface GitHubReleaseResponse {
  tag_name?: string
  html_url?: string
}

/**
 * Never throws — a failed check (offline, rate-limited, no releases published yet) just
 * reports "no update available" rather than surfacing an error anywhere, since this is a
 * background nicety, not a feature the user is ever blocked on.
 */
export async function checkForUpdate(
  fetchImpl: typeof fetch = fetch
): Promise<UpdateCheckResult> {
  const fallback: UpdateCheckResult = {
    available: false,
    latestVersion: null,
    url: GITHUB_RELEASES_URL
  }

  try {
    const res = await fetchImpl(GITHUB_LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8_000)
    })
    if (!res.ok) {
      log.debug(`[update/check] GitHub API returned ${res.status}, skipping`)
      return fallback
    }

    const data = (await res.json()) as GitHubReleaseResponse
    if (!data.tag_name) return fallback

    const available = isNewerVersion(data.tag_name, APP_VERSION)
    return {
      available,
      latestVersion: data.tag_name.replace(/^v/i, ''),
      url: data.html_url ?? GITHUB_RELEASES_URL
    }
  } catch (err) {
    log.debug(`[update/check] Update check failed (non-fatal): ${err}`)
    return fallback
  }
}
