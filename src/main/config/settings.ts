/**
 * Persisted app settings, backing the "Enable Beta Auto-Install (experimental)" toggle
 * (defaulted OFF for safety), the auto-install-after-download sub-toggle, an optional
 * cache directory override, and the remembered list/grid view mode.
 */
import Store from 'electron-store'
import type { AppSettings } from '@shared/types'

const defaults: AppSettings = {
  betaAutoInstall: false,
  cacheDirOverride: null,
  autoInstallAfterDownload: false,
  viewMode: 'list'
}

let store: Store<AppSettings> | null = null

function getStore(): Store<AppSettings> {
  if (!store) {
    store = new Store<AppSettings>({ name: 'settings', defaults })
  }
  return store
}

export function getSettings(): AppSettings {
  const s = getStore()
  return {
    betaAutoInstall: s.get('betaAutoInstall'),
    cacheDirOverride: s.get('cacheDirOverride'),
    autoInstallAfterDownload: s.get('autoInstallAfterDownload'),
    viewMode: s.get('viewMode')
  }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const s = getStore()
  for (const [key, value] of Object.entries(patch)) {
    s.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings])
  }
  return getSettings()
}
