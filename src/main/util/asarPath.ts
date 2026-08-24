/**
 * Electron's `fs` module is patched to transparently read files from inside `app.asar`,
 * and to transparently redirect reads of `asarUnpack`-listed files to the real
 * `app.asar.unpacked` copy on disk. `child_process.spawn()` gets none of that — it hands
 * the path straight to the OS's process-creation call, which has no idea what an asar
 * archive is. A package like `7zip-bin` that computes its own binary path via
 * `path.join(__dirname, ...)` ends up with an path *inside* app.asar, which spawn then
 * fails to find (ENOENT) even though the real file is sitting right next to it in
 * app.asar.unpacked.
 *
 * This is a no-op outside a packaged, asar-enabled build (dev mode, or asar: false),
 * since the string "app.asar" simply won't appear in those paths.
 */
export function resolveAsarUnpackedPath(originalPath: string): string {
  if (originalPath.includes('app.asar.unpacked')) return originalPath
  return originalPath.replace('app.asar', 'app.asar.unpacked')
}
