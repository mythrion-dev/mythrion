'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import {
  applyLanguage,
  normalizeLanguage,
  type Language,
} from '@/i18n'

const OPTIONS: ReadonlyArray<{ code: Language; flag: string; labelKey: 'common:english' | 'common:portuguese' }> = [
  { code: 'en', flag: '🇺🇸', labelKey: 'common:english' },
  { code: 'pt-BR', flag: '🇧🇷', labelKey: 'common:portuguese' },
]

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const current = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function handleSelect(code: Language) {
    setOpen(false)
    await applyLanguage(code)
    // Persist to the backend for authenticated users (DB is authoritative).
    if (user) {
      void api.patch('/auth/language', { language: code }).catch(() => {})
    }
  }

  const currentOption = OPTIONS.find((o) => o.code === current) ?? OPTIONS[0]

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common:language')}
        className={`flex items-center rounded-lg text-sm text-muted hover:text-foreground hover:bg-background/40 transition-colors ${
          compact ? 'w-8 h-8 justify-center px-0 py-0' : 'gap-2 px-2 py-1.5'
        }`}
      >
        <span aria-hidden="true">{currentOption.flag}</span>
        {!compact && (
          <>
            <span className="hidden sm:inline">{t(currentOption.labelKey)}</span>
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('common:language')}
          className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-lg bg-surface border border-border shadow-lg"
        >
          {OPTIONS.map(({ code, flag, labelKey }) => (
            <li key={code} role="option" aria-selected={current === code}>
              <button
                type="button"
                onClick={() => handleSelect(code)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background/60 transition-colors"
              >
                <span aria-hidden="true">{flag}</span>
                <span className="flex-1 text-left">{t(labelKey)}</span>
                {current === code && (
                  <svg
                    className="w-3.5 h-3.5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
