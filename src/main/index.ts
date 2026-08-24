import { app, BrowserWindow, Menu, net, protocol, session, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import log from 'electron-log'
import { is } from '@electron-toolkit/utils'
import { STEAM_PALETTE } from '@shared/constants'
import { registerLibraryIpcHandlers } from '@main/ipc/handlers'
import { registerPatchIpcHandlers } from '@main/ipc/patchHandlers'
import { getCachedSteamPath } from '@main/steam/steamPathStore'
import { resolveBoxArtPath } from '@main/steam/boxArt'

// Must run before app.whenReady() — registers `boxart:` as a standard, secure scheme so
// it behaves like https: for CSP/fetch purposes instead of being treated as opaque.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'boxart',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false }
  }
])

log.initialize()
log.info('[main] Umbra Game Patcher starting up')

// Defense in depth: a bug of the same shape as the write-stream crash this app has
// already hit once (an unhandled 'error' event, or any other truly uncaught rejection
// slipping past an IPC handler's own try/catch) would otherwise show Electron's native
// "A JavaScript error occurred in the main process" dialog and can leave the app in a
// half-broken state. This won't fix the root cause of a bug like that, but it keeps the
// app alive and visible in the logs instead of crashing outright.
process.on('uncaughtException', (err) => {
  log.error('[main] uncaughtException (recovered):', err)
})
process.on('unhandledRejection', (reason) => {
  log.error('[main] unhandledRejection (recovered):', reason)
})

// Applied via a response header rather than a <meta> tag in index.html, since dev and
// production need different policies and a header can be conditioned on `is.dev` at
// runtime — a static meta tag can't. Two important differences from the strict policy:
//   - 'unsafe-eval' in dev: Vite's React Fast Refresh client uses eval() to patch
//     component modules in place; without it the renderer's JS silently fails to run at
//     all (blank window, no console error) rather than just losing hot-reload.
//   - 'unsafe-inline' + ws:/http: connect-src in dev: Vite's dev server and its HMR
//     websocket run on localhost, which isn't 'self' from the loaded electron-vite URL.
function registerContentSecurityPolicy(): void {
  const devCsp =
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: boxart:;"

  const prodCsp =
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: boxart:;"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [is.dev ? devCsp : prodCsp]
      }
    })
  })
}

function registerBoxArtProtocol(): void {
  // Renderer requests <img src="boxart://appicon/228980"> — the appid lives in the
  // *path*, not the host (see the comment in BoxArt.tsx for why: a numeric host gets
  // silently mangled into an IPv4-looking string by Chromium's URL parser for standard
  // schemes). Resolves to a real file:// on disk and streams it via net.fetch, so no
  // image bytes ever pass through IPC/base64.
  protocol.handle('boxart', async (request) => {
    const appid = new URL(request.url).pathname.replace(/^\/+/, '')
    const steamPath = getCachedSteamPath()
    if (!steamPath || !appid) {
      return new Response(null, { status: 404 })
    }
    const filePath = resolveBoxArtPath(steamPath, appid)
    if (!filePath) {
      return new Response(null, { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    minWidth: 950,
    minHeight: 650,
    show: false,
    backgroundColor: STEAM_PALETTE.bgDarkest,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  if (is.dev) {
    win.webContents.openDevTools()
  }

  // Open external links in the OS browser instead of inside the app window. Two separate
  // mechanisms are needed: setWindowOpenHandler covers window.open()/target="_blank",
  // but a plain <a href="..."> click (e.g. a link inside a rendered .docx readme in the
  // instructions viewer) triggers 'will-navigate' instead — without this, clicking one
  // would navigate the *entire app window* to that URL with no way back short of
  // restarting. The app never needs a real page navigation of its own (it's a single-page
  // React app with no routing), so every will-navigate is, by definition, a link the user
  // clicked that should open externally instead.
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    shell.openExternal(url)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // No File/Edit/View/Window/Help bar — this is a single-purpose app, that menu is
  // Electron's unconfigured default, not something we set intentionally.
  Menu.setApplicationMenu(null)

  registerContentSecurityPolicy()
  registerBoxArtProtocol()
  registerLibraryIpcHandlers()
  registerPatchIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
