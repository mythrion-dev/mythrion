/**
 * Result of parsing a valid HTTP Range request.
 */
export interface RangeResult {
  /** Inclusive start byte offset. */
  start: number
  /** Inclusive end byte offset. */
  end: number
  /** Total file size in bytes. */
  contentLength: number
  /** Number of bytes in the chunk (end - start + 1). */
  chunkSize: number
}

/**
 * Parse an HTTP Range header value.
 *
 * Handles:
 * - Normal ranges: `bytes=0-1023`
 * - Open-ended: `bytes=0-`
 * - Suffix: `bytes=-2048`
 * - Single byte: `bytes=0-0`
 * - Multi-range: only the first range is parsed
 *
 * Returns `null` when the header is absent, malformed, or unsatisfiable.
 */
function parseSuffixRange(
  endStr: string,
  fileSize: number,
): { start: number; end: number } | null {
  // Suffix range: bytes=-N → last N bytes
  const suffixLen = Number.parseInt(endStr, 10)
  if (Number.isNaN(suffixLen) || suffixLen <= 0) return null
  return { start: Math.max(0, fileSize - suffixLen), end: fileSize - 1 }
}

function parseOpenEndedRange(
  startStr: string,
  fileSize: number,
): { start: number; end: number } | null {
  // Open-ended: bytes=N-
  const start = Number.parseInt(startStr, 10)
  if (Number.isNaN(start) || start < 0) return null
  return { start, end: fileSize - 1 }
}

function parseExplicitRange(
  startStr: string,
  endStr: string,
): { start: number; end: number } | null {
  // Explicit range: bytes=N-M
  const start = Number.parseInt(startStr, 10)
  const end = Number.parseInt(endStr, 10)
  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end < 0) return null
  if (start > end) return null
  return { start, end }
}

export function parseRange(
  rangeHeader: string | undefined,
  fileSize: number,
): RangeResult | null {
  if (!rangeHeader || fileSize <= 0) return null

  // Only handle single ranges — grab the first one
  const match = /^bytes=(\d*)-(\d*)/i.exec(rangeHeader)
  if (!match) return null

  const startStr = match[1]
  const endStr = match[2]

  let range: { start: number; end: number } | null
  if (startStr === '' && endStr !== '') {
    range = parseSuffixRange(endStr, fileSize)
  } else if (startStr !== '' && endStr === '') {
    range = parseOpenEndedRange(startStr, fileSize)
  } else {
    range = parseExplicitRange(startStr, endStr)
  }

  if (!range) return null

  let { start, end } = range

  // Clamp end to file size
  if (end >= fileSize) {
    end = fileSize - 1
  }

  // Unsatisfiable: start is beyond the file
  if (start >= fileSize) return null

  return {
    start,
    end,
    contentLength: fileSize,
    chunkSize: end - start + 1,
  }
}
