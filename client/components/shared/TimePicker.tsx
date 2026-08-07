'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeLanguage } from '@/i18n'
import { formatHour24, formatMinute, parseHhmm, toHour12, toHour24 } from '@/lib/time'

type Period = 'AM' | 'PM'

interface TimePickerProps {
  /** Stored value — always "HH:MM" (24h) or ""; independent of locale. */
  readonly value: string
  readonly onChange: (value: string) => void
  /** Forwarded to the hour <select> for label htmlFor association. */
  readonly id?: string
  readonly className?: string
}

/**
 * Locale-aware session time picker. pt-BR renders a 24h clock (00–23), en a
 * 12h clock (1–12) with AM/PM toggle. The stored value stays "HH:MM" (24h)
 * regardless of locale, so the value is interchangeable across languages.
 */
export function TimePicker({ value, onChange, id, className }: Readonly<TimePickerProps>) {
  const { t, i18n } = useTranslation()
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)
  const is24h = language === 'pt-BR'

  const [hour, setHour] = useState('')
  const [minute, setMinute] = useState('')
  const [period, setPeriod] = useState<Period>('AM')

  const safeValue = value ?? ''

  // Re-derive the display fields whenever the stored value or locale changes.
  useEffect(() => {
    const parsed = parseHhmm(safeValue)
    if (!parsed) {
      setHour('')
      setMinute('')
      return
    }
    setMinute(formatMinute(parsed.minute))
    if (is24h) {
      setHour(formatHour24(parsed.hour))
    } else {
      setHour(String(toHour12(parsed.hour)))
      setPeriod(parsed.hour >= 12 ? 'PM' : 'AM')
    }
  }, [safeValue, is24h])

  const emit = (h: string, m: string, p: Period) => {
    if (!h) {
      onChange('')
      return
    }
    const mm = m || '00'
    const hour24 = is24h ? Number(h) : toHour24(Number(h), p)
    onChange(`${formatHour24(hour24)}:${mm}`)
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const h = e.target.value
    const m = minute || '00'
    setHour(h)
    setMinute(m)
    emit(h, m, period)
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = e.target.value
    setMinute(m)
    emit(hour, m, period)
  }

  const handlePeriodChange = (p: Period) => {
    setPeriod(p)
    if (hour) emit(hour, minute, p)
  }

  const hourOptions = useMemo(() => {
    if (is24h) return Array.from({ length: 24 }, (_, i) => formatHour24(i))
    return Array.from({ length: 12 }, (_, i) => String(i + 1))
  }, [is24h])

  const minuteOptions = useMemo(
    () => Array.from({ length: 60 }, (_, i) => formatMinute(i)),
    [],
  )

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className ?? ''}`}>
      <select
        id={id}
        value={hour}
        onChange={handleHourChange}
        className="input-field !w-20 !shrink-0"
        aria-label={t('campaign:hour')}
      >
        <option value="">—</option>
        {hourOptions.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-muted shrink-0">:</span>
      <select
        value={minute}
        onChange={handleMinuteChange}
        disabled={!hour}
        className="input-field !w-20 !shrink-0"
        aria-label={t('campaign:minute')}
      >
        <option value="">—</option>
        {minuteOptions.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      {!is24h && (
        <div className="flex gap-1 shrink-0">
          {(['AM', 'PM'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={`tab-pill text-xs !px-2 !py-0.5 ${period === p ? 'tab-pill-active' : ''}`}
            >
              {t(`campaign:${p === 'AM' ? 'am' : 'pm'}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
