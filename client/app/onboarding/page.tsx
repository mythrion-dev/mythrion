'use client'

import { useState, type SubmitEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, completeOnboarding, loading } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user?.onboardingComplete) {
    router.replace('/dashboard')
    return null
  }

  if (!loading && !user) {
    router.replace('/login')
    return null
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await completeOnboarding(displayName.trim())
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4 relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm space-y-6 animate-slide-up relative z-10">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface border border-border ring-1 ring-primary/10 shadow-[0_0_30px_rgba(201,164,75,0.06)]">
            <Image
              src="/logo-icon.png"
              alt="Mythrion logo"
              width={532}
              height={624}
              className="h-12 w-auto"
            />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gradient">
            {t('auth:welcomeTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('auth:welcomeSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card !p-6 space-y-4">
          <div>
            <label htmlFor="displayName" className="label">
              {t('auth:displayName')}
            </label>
            <input
              id="displayName"
              type="text"
              required
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field"
              placeholder={t('auth:displayNamePlaceholder')}
              autoFocus
            />
            <p className="text-xs text-muted mt-1.5">
              {t('auth:displayNameHelper')}
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || displayName.trim().length === 0}
            className="btn-primary w-full"
          >
            {submitting ? t('auth:enrolling') : t('auth:beginJourney')}
          </button>
        </form>
      </div>
    </main>
  )
}