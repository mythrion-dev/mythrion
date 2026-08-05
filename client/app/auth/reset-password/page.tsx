'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { resetPassword } from '@/lib/auth-api'
import { isStrongPassword } from '@/lib/password'
import { PasswordStrength } from '@/components/auth/PasswordStrength'

type ResetStatus = 'form' | 'success' | 'invalid'

function ResetPasswordInner() {
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<ResetStatus>(token ? 'form' : 'invalid')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!isStrongPassword(newPassword)) {
      setError(t('auth:passwordNotStrongEnough'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth:confirmPasswordMismatch'))
      return
    }

    setSubmitting(true)
    try {
      // The backend answers auth.invalidOrExpiredToken for every failure
      // (invalid, expired, reused), so a rejection always lands on the
      // invalid-link state.
      await resetPassword(token!, newPassword)
      setStatus('success')
    } catch {
      setStatus('invalid')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {status === 'success' && (
        <div className="card !p-6 space-y-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-success-muted flex items-center justify-center">
              <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {t('auth:resetPasswordSuccessTitle')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('auth:resetPasswordSuccessDescription')}
              </p>
            </div>
          </div>
          <Link href="/login" className="btn-primary w-full flex items-center justify-center">
            {t('auth:continueToLogin')}
          </Link>
        </div>
      )}

      {status === 'invalid' && (
        <div className="card !p-6 space-y-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-danger-muted flex items-center justify-center">
              <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {t('auth:resetPasswordLinkInvalidTitle')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('auth:resetPasswordLinkInvalidDescription')}
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="flex items-center justify-center text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {t('auth:backToSignIn')}
          </Link>
        </div>
      )}

      {status === 'form' && (
        <div className="card !p-6 space-y-4">
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">
              {t('auth:resetPasswordTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('auth:resetPasswordDescription')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="label">
                {t('auth:newPassword')}
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                placeholder={t('auth:passwordPlaceholder')}
              />
              <PasswordStrength password={newPassword} />
            </div>

            <div>
              <label htmlFor="confirm-password" className="label">
                {t('auth:confirmPassword')}
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder={t('auth:passwordPlaceholder')}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? t('auth:pleaseWait') : t('auth:updatePassword')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  return (
    <main className="flex-1 flex items-center justify-center p-4 relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
        }
      >
        <ResetPasswordInner />
      </Suspense>
    </main>
  )
}
