import type { Language } from '@/i18n'

export interface ParsedHhmm {
  hour: number
  minute: number
}

/** Parse a stored "HH:MM" (24h) value into its parts, or null when invalid/empty. */
export function parseHhmm(value: string): ParsedHhmm | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

export function formatHour24(hour: number): string {
  return String(hour).padStart(2, '0')
}

export function formatMinute(minute: number): string {
  return String(minute).padStart(2, '0')
}

/** 24h hour → 12h clock face (0 → 12, 13 → 1, ...). */
export function toHour12(hour24: number): number {
  const h = hour24 % 12
  return h === 0 ? 12 : h
}

/** 12h clock face + period → 24h hour (12 AM → 0, 12 PM → 12). */
export function toHour24(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour12 % 12
  return (hour12 % 12) + 12
}

/**
 * Format a stored "HH:MM" value for display in the given locale.
 * pt-BR → 24h zero-padded ("08:00"); en → 12h with period ("8:00 AM").
 * Labels are passed in (never hardcoded) so callers can localize them.
 */
export function formatTimeForLocale(
  value: string,
  language: Language,
  amLabel = 'AM',
  pmLabel = 'PM',
): string {
  const parsed = parseHhmm(value)
  if (!parsed) return ''
  if (language === 'pt-BR') {
    return `${formatHour24(parsed.hour)}:${formatMinute(parsed.minute)}`
  }
  const period = parsed.hour >= 12 ? pmLabel : amLabel
  return `${toHour12(parsed.hour)}:${formatMinute(parsed.minute)} ${period}`
}
