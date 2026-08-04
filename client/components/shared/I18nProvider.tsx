'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth-context'
import { applyLanguage, detectLanguage, normalizeLanguage } from '@/i18n'

/**
 * Resolves the user's language after mount so SSR and the first client render
 * are always English (hydration-safe). Order of authority:
 * authenticated user's DB preference → saved localStorage preference →
 * browser language → English. Applies instantly, no page refresh.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const resolvedInitial = useRef(false)

  useEffect(() => {
    if (resolvedInitial.current) return
    resolvedInitial.current = true
    void applyLanguage(detectLanguage())
  }, [])

  // The DB is authoritative once auth resolves, even if it differs from the
  // locally detected/saved preference (e.g. the user switched on another device).
  useEffect(() => {
    if (!user?.language) return
    const language = normalizeLanguage(user.language)
    void applyLanguage(language)
  }, [user?.language])

  return <>{children}</>
}
