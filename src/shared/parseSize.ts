/** Parses human-readable size strings from the database (e.g. "45 MB") into bytes. */
const UNIT_MULTIPLIERS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4
}

export function parseSizeBytes(sizeStr: string | null | undefined): number | null {
  if (!sizeStr || sizeStr.trim().toLowerCase() === 'unknown') return null

  const s = sizeStr.trim().replace(/,/g, '')
  const match = s.match(/([\d.]+)\s*([KMGTP]?B)/i)
  if (match) {
    const val = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    return Math.round(val * (UNIT_MULTIPLIERS[unit] ?? 1))
  }
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  return null
}
