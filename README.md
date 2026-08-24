# Umbra Game Patcher

Detects your installed Steam games, cross-references them against a curated patch database, and helps you download and apply the patches available for your library.

Umbra focuses on **content restoration for adult visual novels and eroge on Steam** — official and community uncensor patches, R18 restoration mods, and the equivalent fixes for titles that shipped censored or cut on Steam.

> **18+.** This tool exists to restore adult content in games you already own. Nothing here bypasses DRM, unlocks paid content, or pirates anything — patches restore content the developer cut, censored, or distributes separately.

> **Safety note:** installing patches is **opt-in**. By default the app only downloads patch files and opens the relevant folders for you to apply them yourself. Nothing is ever written into a game folder or executed without a confirmation dialog naming the exact game, path, and files involved.

## The patch database

Umbra reads `database/patches_database.json` from this repo. That database is the same one behind **[Nukige Reborn](https://nukige.netlify.app/)**, a curated archive of Steam uncensor patches, natively uncensored Steam games, asset-flip tracking, and DRM-free adult games on GOG — maintained by the same author as this app.

Patches are collected from official developer releases, community sources, and in-house work, and are tested before being added. The database is generated from a maintained source-of-truth pipeline rather than scraped, so entries carry real metadata (developer, per-file listings, notes) rather than guesses.

Because patch files are hosted on Google Drive, download reliability depends on those links staying live — the app reports a clear error rather than failing silently when one breaks.

---

## Requirements

- **Node.js 20+**
- **Windows** is the primary target. Linux/macOS builds are configured and the code paths exist, but Steam discovery and the patch pipeline are only regularly exercised on Windows.

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` launches the app with hot-reload and DevTools open.

### If `npm install` blocks install scripts

npm 12+ blocks dependency install/postinstall scripts by default. This project needs three of them — `electron` (downloads the ~100MB Electron binary), `esbuild` (fetches its platform binary), and `registry-js` (compiles the native Windows registry reader). They're pre-approved in `package.json` under `allowScripts`, so a normal `npm install` should just work.

If you still see `install scripts blocked because they are not covered by allowScripts`, run:

```bash
npm approve-scripts --allow-scripts-pending
npm install
```

The symptom of a blocked `electron` script is `npm run dev` failing with `Error: Electron uninstall` — the binary was never downloaded.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev mode: hot-reload + DevTools |
| `npm run build` | Compile main/preload/renderer into `out/` |
| `npm run typecheck` | Type-check both the Node and web tsconfigs |
| `npm run dist:win` | Build + produce an NSIS installer in `dist/` |
| `npm run dist:linux` | Build + produce an AppImage |
| `npm run dist:mac` | Build + produce a dmg |

### Building on Windows

`npm run dist:win` needs permission to create symlinks, or `electron-builder` fails while unpacking its code-signing tools. Either:

- run the terminal **as Administrator**, or
- enable **Developer Mode** (Settings → Update & Security → For developers), which allows symlink creation without elevation.

The installer is unsigned, so Windows SmartScreen will warn on first run. That's expected without a code-signing certificate.

---

## Architecture

```
src/
├── main/                 # Electron main process — all filesystem/network/process work
│   ├── steam/            # Steam install discovery, VDF/ACF parsing, box art lookup
│   ├── database/         # Remote DB fetch (ETag), format normalisation, game matching
│   ├── download/         # Google Drive downloader (resume + progress)
│   ├── archive/          # 7-Zip and RAR extraction / integrity testing
│   ├── patch/            # Cache validation, smart-apply, .exe running, orchestration
│   ├── config/           # Settings, favourites, per-game config, path resolution
│   ├── update/           # GitHub release check (notification only)
│   ├── ipc/              # Typed IPC handlers
│   └── util/
├── preload/              # contextBridge — the renderer's only route to main
├── renderer/src/         # React UI
│   ├── components/
│   ├── store/            # Zustand stores
│   └── styles/
└── shared/               # Types and constants used by both sides
```

**Security model:** the renderer runs sandboxed with `contextIsolation` on and no Node integration. Every filesystem write, process spawn, and network call happens in the main process behind an explicit IPC channel.

---

## How it works

1. **Steam discovery** — Windows registry (via the optional `registry-js`) with a fallback to the usual install paths; `~/.steam`, `~/.local/share/Steam` etc. on Linux; `~/Library/Application Support/Steam` on macOS.
2. **Library scan** — parses `libraryfolders.vdf` and every `appmanifest_*.acf` across *all* Steam libraries, not just the default one.
3. **Database** — conditional GET (ETag) against the patch database on GitHub, so unchanged data isn't re-downloaded. Falls back to the cached copy when offline.
4. **Matching** — cross-references DB entries against installed appids. Sort priority is `favourite + update > update > favourite > rest`, then alphabetical.
5. **Update detection** — each game's `patcher_config.json` records the last applied patch filename. If that filename is no longer in the DB's current file list for that game, an **Update** badge appears.

   ⚠️ This is filename-based. If a patch is re-uploaded under the *same* filename with different contents, it won't be detected as an update.

### Beta Auto-Install

Off by default (Settings → gear icon).

- **Off** — archives are downloaded to the cache folder only; you open the game folder and apply them yourself. `.exe` patches still get an "Install patch" button, since there's no manual alternative to running an installer.
- **On** — archives also get an "Install patch" button that extracts and writes into the game folder using filename matching: exact single match → overwrite in place; multiple matches → skip for safety; no match → add at the archive's relative path.

Either way, **nothing is written into a game folder or executed without a confirmation dialog**.

An optional sub-toggle ("attempt to auto-install patches after downloading") chains the install step onto a download automatically — it still stops at the confirmation dialog.

---

## Data locations

| | Path |
|---|---|
| Windows | `%APPDATA%\umbra-game-patcher\data\` |
| Linux | `~/.config/umbra-game-patcher/data/` |
| macOS | `~/Library/Application Support/umbra-game-patcher/data/` |

Contains `patches_database.json`, its `.etag`, `favorites.json`, `patcher.log`, and `cache/` (downloaded patches — relocatable in Settings).

**Per-game state stays in the game's own install folder** as `patcher_config.json`, recording the last applied patch and what it changed, so it survives an app reinstall.

---

## Gotchas for maintainers

These each cost real debugging time; they're documented in comments at the relevant call sites too.

- **Native binaries and `app.asar`** — `child_process.spawn()` can't execute a path inside `app.asar`, and unlike `fs`, it isn't transparently redirected to `app.asar.unpacked`. Packages shipping spawnable binaries need both an `asarUnpack` entry *and* a path rewrite (`src/main/util/asarPath.ts`).
- **7-Zip can't read RAR** — the `7za` binary bundled by `7zip-bin` is the "light" build with no RAR support. RAR goes through `node-unrar-js` instead; `src/main/archive/index.ts` dispatches by extension.
- **`boxart://` URLs put the appid in the *path*, not the host** — the scheme is registered as `standard`, so Chromium applies special-scheme host parsing, and a purely numeric host gets silently reinterpreted as an IPv4 address (appid `1023740` → `0.15.158.252`).
- **CSP is set via a response header, not a `<meta>` tag** — dev needs `unsafe-eval` for Vite's React Fast Refresh, production doesn't. A `<meta>` CSP can't vary by environment, and if both exist the stricter one wins, silently breaking dev with a blank window.
- **The preload is built as CJS, not ESM** — sandboxed preload scripts have had flaky ESM support; CJS avoids a class of "contextBridge silently never ran" failures.
- **Google Drive's confirmation flow moves** — large files return an HTML interstitial containing a `<form id="download-form">` whose hidden inputs must be replayed as query params. This has changed shape before (a bare `confirm=` token previously) and will again; `src/main/download/googleDrive.ts` keeps fallbacks for the older variants.
- **Attach an `'error'` listener to write streams** — `fs` write streams report open failures via an `'error'` event, not a thrown exception. With no listener, Node escalates it to an uncaught exception that bypasses every `try/catch` and crashes the main process outright.

---

## Updates

The app checks GitHub Releases once at startup and shows a badge in the header if a newer version exists; clicking it opens the release page in your browser. There's no auto-updater — installs stay a deliberate, user-initiated action, and unsigned builds would hit SmartScreen on every auto-downloaded installer anyway.

To publish: tag a release (e.g. `v1.1.0`) and attach the installer from `dist/`.

---

## History

Umbra is a ground-up Electron/TypeScript rewrite of an earlier Python/customtkinter app (`SteamGamePatcher.py`), which is now retired. The mapping between the two — which module replaced which function, what behaviour was preserved deliberately, and what was changed — is kept in [`docs/PORTING-NOTES.md`](docs/PORTING-NOTES.md) for anyone comparing against the old version.

---

## Tech stack

Electron · React · TypeScript · Tailwind CSS · Zustand · electron-vite · electron-builder
