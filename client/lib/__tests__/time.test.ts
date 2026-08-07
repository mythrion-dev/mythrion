import { describe, it, expect } from 'vitest'
import {
  parseHhmm,
  formatHour24,
  formatMinute,
  toHour12,
  toHour24,
  formatTimeForLocale,
} from '@/lib/time'

describe('parseHhmm', () => {
  it('parses a valid 24h value', () => {
    expect(parseHhmm('20:00')).toEqual({ hour: 20, minute: 0 })
    expect(parseHhmm('00:30')).toEqual({ hour: 0, minute: 30 })
    expect(parseHhmm('23:59')).toEqual({ hour: 23, minute: 59 })
    expect(parseHhmm('8:05')).toEqual({ hour: 8, minute: 5 })
  })

  it('rejects invalid values', () => {
    expect(parseHhmm('')).toBeNull()
    expect(parseHhmm('  ')).toBeNull()
    expect(parseHhmm('24:00')).toBeNull()
    expect(parseHhmm('10:60')).toBeNull()
    expect(parseHhmm('not-a-time')).toBeNull()
    expect(parseHhmm('10')).toBeNull()
  })
})

describe('formatHour24 / formatMinute', () => {
  it('zero-pads to two digits', () => {
    expect(formatHour24(0)).toBe('00')
    expect(formatHour24(9)).toBe('09')
    expect(formatHour24(23)).toBe('23')
    expect(formatMinute(0)).toBe('00')
    expect(formatMinute(5)).toBe('05')
    expect(formatMinute(59)).toBe('59')
  })
})

describe('toHour12 / toHour24', () => {
  it('converts 24h hour to 12h clock face', () => {
    expect(toHour12(0)).toBe(12)
    expect(toHour12(1)).toBe(1)
    expect(toHour12(11)).toBe(11)
    expect(toHour12(12)).toBe(12)
    expect(toHour12(13)).toBe(1)
    expect(toHour12(23)).toBe(11)
  })

  it('converts 12h clock face + period back to 24h hour', () => {
    expect(toHour24(12, 'AM')).toBe(0)
    expect(toHour24(1, 'AM')).toBe(1)
    expect(toHour24(11, 'AM')).toBe(11)
    expect(toHour24(12, 'PM')).toBe(12)
    expect(toHour24(1, 'PM')).toBe(13)
    expect(toHour24(11, 'PM')).toBe(23)
  })
})

describe('formatTimeForLocale', () => {
  it('renders 12h with period for English', () => {
    expect(formatTimeForLocale('20:00', 'en')).toBe('8:00 PM')
    expect(formatTimeForLocale('14:30', 'en')).toBe('2:30 PM')
    expect(formatTimeForLocale('11:45', 'en')).toBe('11:45 AM')
    expect(formatTimeForLocale('00:00', 'en')).toBe('12:00 AM')
    expect(formatTimeForLocale('23:59', 'en')).toBe('11:59 PM')
  })

  it('renders 24h for pt-BR', () => {
    expect(formatTimeForLocale('20:00', 'pt-BR')).toBe('20:00')
    expect(formatTimeForLocale('14:30', 'pt-BR')).toBe('14:30')
    expect(formatTimeForLocale('8:05', 'pt-BR')).toBe('08:05')
    expect(formatTimeForLocale('00:00', 'pt-BR')).toBe('00:00')
  })

  it('accepts localized AM/PM labels', () => {
    expect(formatTimeForLocale('20:00', 'en', 'am', 'pm')).toBe('8:00 pm')
    expect(formatTimeForLocale('09:15', 'en', 'a.m.', 'p.m.')).toBe('9:15 a.m.')
  })

  it('returns empty string for invalid/empty input', () => {
    expect(formatTimeForLocale('', 'en')).toBe('')
    expect(formatTimeForLocale('', 'pt-BR')).toBe('')
    expect(formatTimeForLocale('25:00', 'en')).toBe('')
  })
})
