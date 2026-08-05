'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { verifyEmail, resendVerification } from '@/lib/auth-api'

type VerifyStatus = 'verifying' | 'success' | 'invalid'

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const [status, setStatus] = useState<VerifyStatus>('verifying')
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    // Guard against React StrictMode double-invoking the effect: verification
    // has observable side effects (audit + banner refresh), so run it once.
    if (startedRef.current) return
    startedRef.current = true

    const token = searchParams.get('token')
    if (!token) {
      setStatus('invalid')
      return
    }

    verifyEmail(token)
      .then(() => {
        // Notify any open dashboard tab so the banner hides without a refresh.
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('mythrion:email-verified')
            channel.postMessage('verified')
            channel.close()
          }
        } catch {
          // BroadcastChannel can be unavailable in embedded browsers; the
          // banner also refetches on focus, so verification still surfaces.
        }
        setStatus('success')
      })
      .catch(() => {
        setStatus('invalid')
      })
  }, [searchParams])

  async function handleResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setResending(true)
    try {
      await resendVerification(email)
      setResent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:somethingWentWrong'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {status === 'verifying' && (
        <div className="card !p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">
            {t('auth:verifyingEmail')}
          </p>
        </div>
      )}

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
                {t('auth:emailVerifiedTitle')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('auth:emailVerifiedDescription')}
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
                {t('auth:verificationLinkInvalidTitle')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('auth:verificationLinkInvalidDescription')}
              </p>
            </div>
          </div>

          <form onSubmit={handleResend} className="space-y-4">
            <div>
              <label htmlFor="verify-email" className="label">
                {t('auth:email')}
              </label>
              <input
                id="verify-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder={t('auth:emailPlaceholder')}
              />
            </div>
            {resent && (
              <div className="rounded-lg bg-success-muted border border-success/30 px-4 py-2.5 text-sm text-success">
                {t('auth:verificationEmailSent')}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={resending}
              className="btn-primary w-full"
            >
              {resending ? t('auth:pleaseWait') : t('auth:resendVerificationEmail')}
            </button>
          </form>

          <Link
            href="/login"
            className="flex items-center justify-center text-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            {t('auth:backToSignIn')}
          </Link>
        </div>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
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
        <VerifyEmailInner />
      </Suspense>
    </main>
  )
}
