# Porting notes: Python original → Electron rewrite

Reference material kept from the port of the original Python/customtkinter app
(`SteamGamePatcher.py`, v1.4.1-modern) to this Electron/TypeScript codebase.

These notes used to live as header comments in the source files. They were moved here so
the codebase reads as its own thing rather than as a running diff against a retired app —
but the mapping is worth keeping for anyone comparing behaviour against the old version.

---

## Module mapping

| Electron module | Python counterpart |
|---|---|
| `main/steam/discovery.ts` | `get_steam_path()` |
| `main/steam/library.ts` | `get_installed_games()` |
| `main/steam/vdf.ts` | inline VDF/ACF parsing in `get_installed_games()` |
| `main/steam/boxArt.ts` | `load_box_art_pil()` (candidate discovery half) |
| `main/database/fetch.ts` | `App._download_database()` |
| `main/database/flatten.ts` | `flatten_game_contents()` |
| `main/database/normalize.ts` | DB-format block in `App.__init__` + `App._group_changes()` |
| `main/database/match.ts` | "BUILD MATCHES" block in `App.__init__`, `App._has_update()`, `App._sorted_matches()` |
| `main/config/favorites.ts` | `load_favorites()` / `save_favorites()` |
| `main/config/perGameConfig.ts` | `App._load_configs()`, `App._migrate_old_config()`, `App.save_per_game_config()` |
| `main/config/paths.ts` | the script-relative `data/` folder convention |
| `main/download/googleDrive.ts` | `gdown` usage inside `App.process_patch()` |
| `main/archive/sevenZip.ts` | `App.extract_with_7z()` / `App.extract_archive()` |
| `main/patch/cache.ts` | cache-reuse block at the top of `process_patch()`'s per-file loop |
| `main/patch/smartApply.ts` | `App.smart_apply_patch()` |
| `main/patch/runExe.ts` | `.exe` branch inside `App.process_patch()` |
| `main/patch/processPatch.ts` | `App.process_patch()` |
| `main/patch/instructions.ts` | the full-screen instruction viewer dialog |
| `shared/parseSize.ts` | `App.parse_size_bytes()` |
| `shared/fileKind.ts` | `self.viewable_exts = (".txt", ".docx", ".pdf")` |
| `shared/constants.ts` | module-level constants + the `C` color class |
| `renderer/store/libraryStore.ts` | Tk `App` instance attrs (`self.view_mode`, `self.search_var`, `self.current_appid`) |
| `renderer/components/GameList.tsx` | `ttk.Treeview` rows |

Data-shape equivalences: `InstalledGamesMap` ↔ `self.installed`, `GameMatch[]` ↔
`self.matches`, the appid lookup ↔ `self.by_id`, `LastAppliedMap` ↔ `self.last_applied`.

---

## Behaviour deliberately preserved

- **Per-game config filename and shape.** `patcher_config.json` is written into the game's
  own install directory with the same filename and structure as the Python version, so
  both apps read and write the same file with no migration needed.
- **Old global config migration.** A one-time migration folds a legacy global
  `data/last_applied.json` into per-game configs, then deletes it.
- **Sort priority.** favourite+update > update > favourite > rest, alphabetical within
  each tier — a direct port of the tuple-key sort the Python UI used when populating the
  Treeview/grid.
- **Smart-apply matching rules.** Exact single filename match → overwrite in place;
  multiple matches → skip for safety; no match → add at the archive's relative path.
- **Cache trust rules.** A cached file is reused if its size is within 5% of the expected
  size (or the file is tiny and non-empty) *and* it passes an archive integrity test.
  `.exe` files skip the integrity test since they aren't archives — mirroring the Python
  gate, which only ran `7z t` on non-exe cache hits.
- **Download retries.** Up to 3 attempts, deleting the partial file between tries.
- **Box art search order.** Modern flat `appcache/librarycache/<appid>_library_600x900.*`
  files → legacy deep scan of `appcache/librarycache/<appid>/` → custom
  `userdata/<user>/config/grid/` art, with custom grid art winning when present.
- **DB fetch is fail-soft.** A network failure leaves the cached database in place rather
  than blocking startup.
- **Accept any content item with an id.** The DB's `type` field is inconsistent
  (`".exe"`, `".zip"`, `"file"`, `null`...), so flattening filters on the presence of an
  id rather than on type.
- **Update detection is filename-based.** A game shows an update badge when its recorded
  last-applied filename is no longer present in the DB's current file list for that game.
  Same limitation as the original: a patch re-uploaded under an identical filename won't
  be detected.

## Behaviour deliberately changed

- **Auto-apply is now opt-in.** The Python version always extracted and wrote into game
  folders. Here that's behind a Beta Auto-Install toggle (off by default), and nothing is
  written or executed without a confirmation dialog naming the exact game, path, and files.
- **Data location.** Python wrote to a `data/` folder next to the script. Electron apps
  can't assume a writable folder next to the binary (Program Files is read-only, macOS
  bundles are signed), so per-OS `userData` is used instead, keeping the same filenames
  underneath it. Per-game config still lives in the game folder.
- **Elevation.** Python prompted for admin at startup. Elevation is now requested by the
  installer manifest instead, rather than as a runtime prompt on every launch.
- **Box art rendering.** Python opened the image with PIL, thumbnailed it, and pasted it
  onto a 200x300 canvas. Here the main process only resolves the best file path and serves
  it over a custom `boxart://` protocol; sizing/cropping is CSS `object-fit`, which is
  faster and avoids passing image bytes over IPC.
- **Missing box art fallback.** Python shipped a `no-box-art.png` with drawn-on text. This
  uses a CSS placeholder showing the game's initials — no bundled asset needed.
- **7-Zip.** Python shelled out to a `7z.exe` expected to sit next to the script. Here
  `7zip-bin` provides bundled binaries for all three platforms. RAR needed a separate
  library (`node-unrar-js`) because the bundled `7za` is the "light" build without RAR
  support.
- **Google Drive downloads.** No Node equivalent of `gdown` exists, so its wire behaviour
  is reimplemented directly: the confirmation-page flow, cookie forwarding, and a browser
  User-Agent. Resume uses HTTP Range requests instead of gdown's internal resume flag.
- **Instruction viewer.** Python rendered DOCX (via python-docx) and PDF (via PyMuPDF) in
  a native dialog. Here `.txt` and `.docx` (via `mammoth`) render in-app; PDF opens in the
  OS default viewer for now.
- **Dependency management.** Python auto-installed missing packages at startup. Electron
  bundles its dependencies, so this was dropped entirely.
- **Concurrency.** Python used threads plus a queue to keep the Tk UI responsive. Electron's
  main/renderer split with async IPC replaces that model.
- **Progress reporting.** Python's `progress_bar=-1` "indeterminate" convention is kept as
  a `percent: -1` sentinel in the progress events.
- **Settings.** The Python app had no settings UI at all and no cache-location option;
  both are new here.
