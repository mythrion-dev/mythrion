import { describe, it, expect } from '@jest/globals'
import { parseRange, type RangeResult } from './range-parser'

const FILE_SIZE = 10_000

describe('parseRange', () => {
  // -----------------------------------------------------------------------
  // Normal ranges
  // -----------------------------------------------------------------------

  it('parses a normal byte range', () => {
    const result = parseRange('bytes=0-1023', FILE_SIZE)
    expect(result).toEqual({
      start: 0,
      end: 1023,
      contentLength: FILE_SIZE,
      chunkSize: 1024,
    })
  })

  it('parses a range starting at non-zero offset', () => {
    const result = parseRange('bytes=500-1499', FILE_SIZE)
    expect(result).toEqual({
      start: 500,
      end: 1499,
      contentLength: FILE_SIZE,
      chunkSize: 1000,
    })
  })

  it('parses a single-byte range', () => {
    const result = parseRange('bytes=42-42', FILE_SIZE)
    expect(result).toEqual({
      start: 42,
      end: 42,
      contentLength: FILE_SIZE,
      chunkSize: 1,
    })
  })

  it('parses a range at the very end of the file', () => {
    const result = parseRange('bytes=9999-9999', FILE_SIZE)
    expect(result).toEqual({
      start: 9999,
      end: 9999,
      contentLength: FILE_SIZE,
      chunkSize: 1,
    })
  })

  // -----------------------------------------------------------------------
  // Open-ended ranges
  // -----------------------------------------------------------------------

  it('parses an open-ended range (bytes=N-)', () => {
    const result = parseRange('bytes=9000-', FILE_SIZE)
    expect(result).toEqual({
      start: 9000,
      end: 9999,
      contentLength: FILE_SIZE,
      chunkSize: 1000,
    })
  })

  it('parses bytes=0- as the full file', () => {
    const result = parseRange('bytes=0-', FILE_SIZE)
    expect(result).toEqual({
      start: 0,
      end: 9999,
      contentLength: FILE_SIZE,
      chunkSize: FILE_SIZE,
    })
  })

  // -----------------------------------------------------------------------
  // Suffix ranges
  // -----------------------------------------------------------------------

  it('parses a suffix range (bytes=-N)', () => {
    const result = parseRange('bytes=-2048', FILE_SIZE)
    expect(result).toEqual({
      start: 7952,
      end: 9999,
      contentLength: FILE_SIZE,
      chunkSize: 2048,
    })
  })

  it('clamps suffix larger than file to entire file', () => {
    const result = parseRange('bytes=-99999', FILE_SIZE)
    expect(result).toEqual({
      start: 0,
      end: 9999,
      contentLength: FILE_SIZE,
      chunkSize: FILE_SIZE,
    })
  })

  // -----------------------------------------------------------------------
  // Clamping
  // -----------------------------------------------------------------------

  it('clamps end to file size when range exceeds file', () => {
    const result = parseRange('bytes=9000-20000', FILE_SIZE)
    expect(result).toEqual({
      start: 9000,
      end: 9999,
      contentLength: FILE_SIZE,
      chunkSize: 1000,
    })
  })

  // -----------------------------------------------------------------------
  // Invalid / unsatisfiable ranges
  // -----------------------------------------------------------------------

  it('returns null for undefined header', () => {
    expect(parseRange(undefined, FILE_SIZE)).toBeNull()
  })

  it('returns null for empty string header', () => {
    expect(parseRange('', FILE_SIZE)).toBeNull()
  })

  it('returns null for zero file size', () => {
    expect(parseRange('bytes=0-100', 0)).toBeNull()
  })

  it('returns null for negative file size', () => {
    expect(parseRange('bytes=0-100', -1)).toBeNull()
  })

  it('returns null for malformed header (no prefix)', () => {
    expect(parseRange('0-100', FILE_SIZE)).toBeNull()
  })

  it('returns null for malformed header (garbage)', () => {
    expect(parseRange('not-a-range', FILE_SIZE)).toBeNull()
  })

  it('returns null when start > end', () => {
    expect(parseRange('bytes=500-100', FILE_SIZE)).toBeNull()
  })

  it('returns null when start is beyond file size', () => {
    expect(parseRange('bytes=20000-30000', FILE_SIZE)).toBeNull()
  })

  it('returns null when suffix value is non-numeric', () => {
    expect(parseRange('bytes=-abc', FILE_SIZE)).toBeNull()
  })

  it('returns null for negative suffix', () => {
    expect(parseRange('bytes=--100', FILE_SIZE)).toBeNull()
  })

  // -----------------------------------------------------------------------
  // Multi-range — only first is parsed
  // -----------------------------------------------------------------------

  it('parses only the first range of a multi-range header', () => {
    const result = parseRange('bytes=0-1023,2048-4095', FILE_SIZE)
    expect(result).toEqual({
      start: 0,
      end: 1023,
      contentLength: FILE_SIZE,
      chunkSize: 1024,
    })
  })

  // -----------------------------------------------------------------------
  // Case insensitivity
  // -----------------------------------------------------------------------

  it('handles case-insensitive Bytes prefix', () => {
    const result = parseRange('BYTES=100-199', FILE_SIZE)
    expect(result).toEqual({
      start: 100,
      end: 199,
      contentLength: FILE_SIZE,
      chunkSize: 100,
    })
  })
})
