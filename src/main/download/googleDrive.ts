/**
 * Google Drive downloader. Google's "can't scan this file for viruses" interstitial is an
 * actively-moving target, not a stable API. As of 2026 the flow for a file too large to
 * virus-scan is:
 *
 *   1. GET drive.google.com/uc?id=<id>&export=download
 *   2. If the response is the file itself (small files): done.
 *   3. If it's an HTML warning page, that page contains:
 *        <form id="download-form" action="https://drive.usercontent.google.com/download" method="get">
 *          <input type="hidden" name="id" value="...">
 *          <input type="hidden" name="confirm" value="t">
 *          <input type="hidden" name="uuid" value="...">
 *          ...
 *        </form>
 *      — GET the form's `action` URL with every hidden input as a query param, and
 *        *that* response is the real file.
 *
 * A couple of older, simpler variants (a bare `confirm=TOKEN` link, or a
 * `download_warning...` cookie carrying the token) still show up occasionally, so those
 * are kept as fallbacks. Session cookies from step 1 are captured and forwarded to step 3,
 * and a realistic desktop browser User-Agent is sent throughout — Google has previously
 * blocked non-browser-looking User-Agents outright regardless of the rest of the flow
 * being correct.
 */
import { createWriteStream, existsSync, statSync } from 'node:fs'
import { rename, unlink } from 'node:fs/promises'
import log from 'electron-log'

export interface DownloadProgress {
  /** 0-100, or -1 when the total size is unknown (indeterminate progress). */
  percent: number
  bytesDownloaded: number
  /** MB/s */
  speed: number
}

export type ProgressCallback = (progress: DownloadProgress) => void

const DRIVE_BASE = 'https://drive.google.com/uc'
const CONFIRM_TOKEN_RE = /confirm=([0-9A-Za-z_-]+)/
const DOWNLOAD_WARNING_COOKIE_RE = /download_warning[^=]*=([0-9A-Za-z_-]+)/
const FORM_RE = /<form[^>]*id="download-form"[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i
const HIDDEN_INPUT_RE = /<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/** Merges Set-Cookie headers from a response into a single Cookie header value. */
function collectCookies(res: Response, existing: string): string {
  // Node's fetch (undici) folds multiple Set-Cookie headers into one comma-joined string
  // on `headers.get`; splitting on ", " after a "=" is good enough here since we only
  // need name=value pairs, not full cookie attributes (Path, Expires, etc.).
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) return existing
  const pairs = setCookie
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
  const merged = existing ? [existing, ...pairs] : pairs
  return merged.join('; ')
}

interface ResolvedDownload {
  url: string
  cookie: string
}

async function resolveDownloadUrl(
  fileId: string,
  fetchImpl: typeof fetch
): Promise<ResolvedDownload> {
  const initialUrl = `${DRIVE_BASE}?id=${encodeURIComponent(fileId)}&export=download`
  const res = await fetchImpl(initialUrl, {
    redirect: 'follow',
    headers: { 'User-Agent': BROWSER_USER_AGENT }
  })
  const cookie = collectCookies(res, '')
  const contentType = res.headers.get('content-type') ?? ''

  if (!contentType.includes('text/html')) {
    // Small file — Google served the bytes directly, this response IS the download.
    // We discard the body here and let the caller re-request the same (now-cacheable)
    // URL for the actual streaming download, keeping this function's contract simple
    // (URL in, URL out) rather than plumbing a partially-consumed body through.
    await res.body?.cancel()
    return { url: initialUrl, cookie }
  }

  const html = await res.text()

  // Primary path: parse the real confirmation form Google currently serves.
  const formMatch = html.match(FORM_RE)
  if (formMatch) {
    const [, action, formInner] = formMatch
    const params = new URLSearchParams()
    for (const inputMatch of formInner.matchAll(HIDDEN_INPUT_RE)) {
      params.set(inputMatch[1], inputMatch[2])
    }
    if (!params.has('id')) params.set('id', fileId)
    return { url: `${action}?${params.toString()}`, cookie }
  }

  // Fallbacks for older/simpler confirmation variants.
  const tokenMatch = html.match(CONFIRM_TOKEN_RE) ?? html.match(DOWNLOAD_WARNING_COOKIE_RE)
  if (tokenMatch) {
    return {
      url: `${DRIVE_BASE}?id=${encodeURIComponent(fileId)}&export=download&confirm=${tokenMatch[1]}`,
      cookie
    }
  }

  throw new Error(
    'Google Drive did not return a downloadable file (no confirmation form or token found — the file may be private, deleted, or rate-limited).'
  )
}

/**
 * Downloads a Google Drive file by its file ID to `outputPath`, resuming a partial
 * download if one already exists on disk. Retries are the caller's responsibility
 * (obtainFile in patch/cache.ts loops up to 3 attempts).
 */
export async function downloadFromGoogleDrive(
  fileId: string,
  outputPath: string,
  onProgress: ProgressCallback,
  fetchImpl: typeof fetch = fetch
): Promise<number> {
  const { url, cookie } = await resolveDownloadUrl(fileId, fetchImpl)

  // Resume state is about the *partial* download, so it has to be judged by the .part
  // file's own existence/size — not outputPath's. outputPath only exists once a download
  // has already fully completed and been renamed into place, at which point obtainFile()
  // wouldn't be calling this function again anyway. Checking outputPath here was the root
  // cause of a real crash: if it existed (e.g. a concurrent download for the same file had
  // just finished) while tmpPath didn't, this would still decide to "resume" and then
  // fail to open a .part file that was never created.
  const tmpPath = `${outputPath}.part`
  const initialSize = existsSync(tmpPath) ? statSync(tmpPath).size : 0
  const headers: Record<string, string> = { 'User-Agent': BROWSER_USER_AGENT }
  if (cookie) headers['Cookie'] = cookie
  if (initialSize > 0) headers['Range'] = `bytes=${initialSize}-`

  const res = await fetchImpl(url, { headers, redirect: 'follow' })
  if (!res.ok && res.status !== 206) {
    throw new Error(`Google Drive download failed: HTTP ${res.status}`)
  }
  if (!res.body) {
    throw new Error('Google Drive download failed: empty response body')
  }

  // A server that ignores our Range header and returns 200 (full body) instead of 206
  // means it doesn't support resume for this file — start over rather than corrupt the
  // file by appending full content after a partial one.
  const isResuming = initialSize > 0 && res.status === 206
  const startOffset = isResuming ? initialSize : 0

  const contentLength = res.headers.get('content-length')
  const totalBytes = contentLength ? startOffset + parseInt(contentLength, 10) : null

  const writeStream = createWriteStream(tmpPath, {
    flags: isResuming ? 'r+' : 'w',
    start: startOffset
  })

  // fs write streams open the underlying file descriptor asynchronously — if that open
  // fails (e.g. 'r+' on a .part file that doesn't exist, the exact bug that caused a
  // real crash here), the stream emits an 'error' event, not a thrown exception. Node's
  // default behavior for an 'error' event with *no* listener is to throw it as an
  // uncaught exception — which in Electron's main process shows the native "A JavaScript
  // error occurred" crash dialog and bypasses every try/catch in this file entirely.
  // Attaching this listener is what turns that into a normal, catchable rejection instead.
  let streamError: Error | null = null
  writeStream.on('error', (err) => {
    streamError = err
  })

  let downloaded = startOffset
  const startTime = Date.now()
  let lastEmit = 0

  const reader = res.body.getReader()
  try {
    for (;;) {
      if (streamError) throw streamError
      const { done, value } = await reader.read()
      if (done) break
      downloaded += value.byteLength
      await new Promise<void>((resolve, reject) => {
        writeStream.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()))
      }).catch((err) => {
        throw streamError ?? err
      })
      if (streamError) throw streamError

      const now = Date.now()
      if (now - lastEmit > 200) {
        lastEmit = now
        const elapsedSec = (now - startTime) / 1000
        const speedMBs = elapsedSec > 0 ? (downloaded - startOffset) / elapsedSec / (1024 * 1024) : 0
        onProgress({
          percent: totalBytes ? Math.min(100, (downloaded / totalBytes) * 100) : -1,
          bytesDownloaded: downloaded,
          speed: speedMBs
        })
      }
    }
  } finally {
    await new Promise<void>((resolve) => writeStream.end(resolve))
  }

  if (streamError) throw streamError

  await rename(tmpPath, outputPath).catch(async (err) => {
    log.error(`[download/googleDrive] Failed to finalize download: ${err}`)
    await unlink(tmpPath).catch(() => {})
    throw err
  })

  onProgress({ percent: 100, bytesDownloaded: downloaded, speed: 0 })
  return downloaded
}
