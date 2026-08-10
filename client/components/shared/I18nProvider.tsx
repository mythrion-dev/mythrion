'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth-context'
import { applyLanguage, DEFAULT_LANGUAGE, detectLanguage, normalizeLanguage } from '@/i18n'

/**
 * Resolves the user's language after mount so SSR and the first client render
 * are always English (hydration-safe). Order of authority:
 * authenticated user's explicit DB choice → saved localStorage preference →
 * browser language → English. Applies instantly, no page refresh.
 */
export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const { user } = useAuth()
  const resolvedInitial = useRef(false)

  useEffect(() => {
    if (resolvedInitial.current) return
    resolvedInitial.current = true
    void applyLanguage(detectLanguage())
  }, [])

  // The DB field defaults to "en" and getProfile always returns it as a
  // string, so a user who never chose a language looks identical to one who
  // chose English. Treating that default as authoritative would reset a
  // stored/browser pt-BR preference back to English on every authenticated
  // load. The DB is only trusted when it holds a non-default choice, or when
  // the locally resolved preference already agrees with it.
  useEffect(() => {
    if (!user?.language) return
    const language = normalizeLanguage(user.language)
    if (language === DEFAULT_LANGUAGE && detectLanguage() !== DEFAULT_LANGUAGE) return
    void applyLanguage(language)
  }, [user?.language])

  return <>{children}</>
}
