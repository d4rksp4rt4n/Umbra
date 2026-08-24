import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

/**
 * Writes a visible error message directly into the page, bypassing React entirely.
 * If something goes wrong early enough (preload didn't run, a module failed to import,
 * React itself threw before mounting anything), the window would otherwise just show a
 * blank/dark rectangle with no clue why — this makes the failure visible without needing
 * DevTools open.
 */
function showFatalError(context: string, err: unknown): void {
  console.error(`[renderer] Fatal error (${context}):`, err)
  const root = document.getElementById('root')
  if (!root) return
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; color: #ffb4b4; background: #171a21; padding: 24px; min-height: 100vh; box-sizing: border-box;">
      <h2 style="margin-top:0;">Umbra Game Patcher failed to start</h2>
      <p style="color:#c6d4df;">Context: ${context}</p>
      <pre style="white-space: pre-wrap; background:#1e2a3a; padding:12px; border-radius:6px; color:#ffb4b4;">${message}</pre>
      <p style="color:#8f98a0; font-size: 12px;">Open DevTools (Ctrl+Shift+I) → Console tab for the full stack trace.</p>
    </div>`
}

window.addEventListener('error', (e) => showFatalError('window.onerror', e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => showFatalError('unhandledrejection', e.reason))

if (!window.patcher) {
  showFatalError(
    'preload bridge missing',
    new Error(
      "window.patcher is undefined — the preload script didn't run (or contextBridge failed). Check the DevTools Console for a preload error."
    )
  )
} else {
  try {
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  } catch (err) {
    showFatalError('React render', err)
  }
}
