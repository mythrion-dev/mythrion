import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import i18n, {
  normalizeLanguage,
  applyLanguage,
  detectLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  NAMESPACES,
} from '@/i18n'

describe('i18n exports', () => {
  it('exposes exactly the two supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'pt-BR'])
  })

  it('defaults to English', () => {
    expect(DEFAULT_LANGUAGE).toBe('en')
  })

  it('uses a stable localStorage key', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe('mythrion_language')
  })

  it('exposes all 20 namespaces', () => {
    expect(NAMESPACES).toHaveLength(20)
    for (const ns of ['common', 'auth', 'errors', 'billing', 'combat', 'templates']) {
      expect(NAMESPACES).toContain(ns)
    }
  })
})

describe('normalizeLanguage', () => {
  it('keeps pt-BR as-is', () => {
    expect(normalizeLanguage('pt-BR')).toBe('pt-BR')
  })

  it('maps bare pt to pt-BR', () => {
    expect(normalizeLanguage('pt')).toBe('pt-BR')
  })

  it('maps other pt locales to pt-BR', () => {
    expect(normalizeLanguage('pt-PT')).toBe('pt-BR')
    expect(normalizeLanguage('pt-BR,pt;q=0.9')).toBe('pt-BR')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(normalizeLanguage('  PT-br ')).toBe('pt-BR')
  })

  it('keeps en as-is', () => {
    expect(normalizeLanguage('en')).toBe('en')
  })

  it('maps en-US to en', () => {
    expect(normalizeLanguage('en-US')).toBe('en')
    expect(normalizeLanguage('en-US,en;q=0.9')).toBe('en')
  })

  it('defaults to en for missing input', () => {
    expect(normalizeLanguage(undefined)).toBe('en')
    expect(normalizeLanguage(null)).toBe('en')
    expect(normalizeLanguage('')).toBe('en')
  })

  it('defaults to en for unsupported languages', () => {
    expect(normalizeLanguage('fr-FR')).toBe('en')
    expect(normalizeLanguage('garbage')).toBe('en')
  })
})

describe('applyLanguage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    window.localStorage.clear()
  })

  afterEach(async () => {
    await i18n.changeLanguage('en')
    window.localStorage.clear()
  })

  it('switches i18next to the target language', async () => {
    await applyLanguage('pt-BR')
    expect(i18n.resolvedLanguage).toBe('pt-BR')
  })

  it('persists the preference and updates <html lang>', async () => {
    await applyLanguage('pt-BR')
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt-BR')
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  it('switches back to English after Portuguese', async () => {
    await applyLanguage('pt-BR')
    await applyLanguage('en')
    expect(i18n.resolvedLanguage).toBe('en')
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('is a no-op on i18next when already on that language', async () => {
    const spy = vi.spyOn(i18n, 'changeLanguage')
    await applyLanguage('en')
    expect(spy).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    spy.mockRestore()
  })
})

describe('detectLanguage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    window.localStorage.clear()
  })

  afterEach(async () => {
    await i18n.changeLanguage('en')
    window.localStorage.clear()
  })

  it('returns the saved preference from localStorage', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pt-BR')
    expect(detectLanguage()).toBe('pt-BR')
  })

  it('normalizes an unsupported saved value to en', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr')
    expect(detectLanguage()).toBe('en')
  })

  it('falls back to the browser language when nothing is saved', () => {
    expect(detectLanguage()).toBe('en')
  })
})
