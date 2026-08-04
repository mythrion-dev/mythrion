import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import resourcesToBackend from 'i18next-resources-to-backend'
import type { ResourceKey } from 'i18next'

import common from './locales/en/common.json'
import auth from './locales/en/auth.json'
import dashboard from './locales/en/dashboard.json'
import campaign from './locales/en/campaign.json'
import character from './locales/en/character.json'
import abilities from './locales/en/abilities.json'
import attributes from './locales/en/attributes.json'
import skills from './locales/en/skills.json'
import inventory from './locales/en/inventory.json'
import modifiers from './locales/en/modifiers.json'
import summons from './locales/en/summons.json'
import notebook from './locales/en/notebook.json'
import books from './locales/en/books.json'
import combat from './locales/en/combat.json'
import validation from './locales/en/validation.json'
import errors from './locales/en/errors.json'
import community from './locales/en/community.json'
import templates from './locales/en/templates.json'
import billing from './locales/en/billing.json'

export const SUPPORTED_LANGUAGES = ['en', 'pt-BR'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_STORAGE_KEY = 'mythrion_language'

export const NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'campaign',
  'character',
  'abilities',
  'attributes',
  'skills',
  'inventory',
  'modifiers',
  'summons',
  'notebook',
  'books',
  'combat',
  'validation',
  'errors',
  'community',
  'templates',
  'billing',
] as const

/** Map any detected/input code to one of our supported languages. */
export function normalizeLanguage(input?: string | null): Language {
  const lower = (input ?? '').toLowerCase().trim()
  if (!lower) return DEFAULT_LANGUAGE
  if (lower.startsWith('pt')) return 'pt-BR'
  if (lower.startsWith('en')) return 'en'
  return DEFAULT_LANGUAGE
}

/**
 * Persist + apply a language across the app. Writes the preference to
 * localStorage, updates <html lang>, and — when different from the current
 * language — switches i18next (which also re-renders every useTranslation
 * subscriber). API-free on purpose: the singleton is imported by lib/api.ts
 * (for Accept-Language), so it must never import api back.
 */
export async function applyLanguage(language: Language): Promise<void> {
  if (i18n.resolvedLanguage !== language) {
    await i18n.changeLanguage(language)
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // Storage unavailable (private browsing / restrictive env) — non-fatal.
    }
    document.documentElement.lang = language
  }
}

/** Resolve the user's preferred language: saved preference → browser → en. */
export function detectLanguage(): Language {
  try {
    const detected = i18n.services.languageDetector?.detect?.()
    const code = Array.isArray(detected) ? detected[0] : detected
    return normalizeLanguage(code)
  } catch {
    return DEFAULT_LANGUAGE
  }
}

// English is statically bundled (instant SSR + first client render, and the
// test baseline). pt-BR is loaded lazily per-namespace via dynamic imports, so
// a user on English never pays for the Portuguese catalog (and vice-versa).
// Adding a new language = add JSON catalogs + a loader entry here only.
const enResources = {
  common,
  auth,
  dashboard,
  campaign,
  character,
  abilities,
  attributes,
  skills,
  inventory,
  modifiers,
  summons,
  notebook,
  books,
  combat,
  validation,
  errors,
  community,
  templates,
  billing,
}

const ptBrLoaders: Record<string, () => Promise<ResourceKey>> = {
  common: () => import('./locales/pt-BR/common.json').then((m) => m.default),
  auth: () => import('./locales/pt-BR/auth.json').then((m) => m.default),
  dashboard: () => import('./locales/pt-BR/dashboard.json').then((m) => m.default),
  campaign: () => import('./locales/pt-BR/campaign.json').then((m) => m.default),
  character: () => import('./locales/pt-BR/character.json').then((m) => m.default),
  abilities: () => import('./locales/pt-BR/abilities.json').then((m) => m.default),
  attributes: () => import('./locales/pt-BR/attributes.json').then((m) => m.default),
  skills: () => import('./locales/pt-BR/skills.json').then((m) => m.default),
  inventory: () => import('./locales/pt-BR/inventory.json').then((m) => m.default),
  modifiers: () => import('./locales/pt-BR/modifiers.json').then((m) => m.default),
  summons: () => import('./locales/pt-BR/summons.json').then((m) => m.default),
  notebook: () => import('./locales/pt-BR/notebook.json').then((m) => m.default),
  books: () => import('./locales/pt-BR/books.json').then((m) => m.default),
  combat: () => import('./locales/pt-BR/combat.json').then((m) => m.default),
  validation: () => import('./locales/pt-BR/validation.json').then((m) => m.default),
  errors: () => import('./locales/pt-BR/errors.json').then((m) => m.default),
  community: () => import('./locales/pt-BR/community.json').then((m) => m.default),
  templates: () => import('./locales/pt-BR/templates.json').then((m) => m.default),
  billing: () => import('./locales/pt-BR/billing.json').then((m) => m.default),
}

// `lng` is pinned to the default so the language detector does NOT run during
// init — SSR and the first client render are both English, avoiding hydration
// mismatches. I18nProvider resolves the real language post-mount.
i18n
  .use(
    resourcesToBackend((language: string, namespace: string) => {
      if (language === 'pt-BR') {
        const loader = ptBrLoaders[namespace]
        if (loader) return loader()
        return Promise.resolve({})
      }
      return undefined
    }),
  )
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: enResources },
    // en is statically bundled above; pt-BR is loaded via resourcesToBackend.
    // Without this, i18next assumes every language is bundled and never calls
    // the backend, so switching to pt-BR would silently fall back to en.
    partialBundledLanguages: true,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    ns: [...NAMESPACES],
    defaultNS: 'common',
    fallbackNS: 'common',
    initAsync: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => normalizeLanguage(lng),
    },
    react: { useSuspense: false },
  })

export default i18n
