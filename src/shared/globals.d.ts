/**
 * Injected at build time by electron.vite.config.ts, read straight out of package.json's
 * `version` field. package.json is the single source of truth for the app version: it is
 * what electron-builder stamps onto the installer, and what the release workflow checks
 * the git tag against, so APP_VERSION must derive from it rather than be a second copy
 * that can silently drift. A drifted copy is not a cosmetic bug — checkUpdate.ts compares
 * APP_VERSION against the latest GitHub release tag, so a stale value makes the app
 * permanently advertise an update to users who are already running it.
 */
declare const __APP_VERSION__: string
