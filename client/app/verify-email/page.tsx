'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import { resendVerification, changeEmail } from '@/lib/auth-api'

function VerifyEmailWaiting() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading, logout, refreshProfile } = useAuth()

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null)
  const [emailChanged, setEmailChanged] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (user?.emailVerified) router.replace('/dashboard')
  }, [user, router])

  // A verification completed in another tab (or after clicking the email link)
  // bumps the profile; once emailVerified flips, the redirect effect above fires.
  useEffect(() => {
    let channel: BroadcastChannel | null = null
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('mythrion:email-verified')
        channel.onmessage = () => void refreshProfile()
      }
    } catch {
      // BroadcastChannel can be unavailable in embedded browsers; the Refresh
      // button below is the fallback.
    }
    return () => channel?.close()
  }, [refreshProfile])

  async function handleResend() {
    if (!user || resending) return
    setResending(true)
    setResent(false)
    setResendError(null)
    try {
      await resendVerification(user.email)
      setResent(true)
    } catch (err) {
      setResendError(
        err instanceof Error ? err.message : t('auth:somethingWentWrong'),
      )
    } finally {
      setResending(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshProfile()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleChangeEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (changingEmail) return
    setChangingEmail(true)
    setChangeEmailError(null)
    setEmailChanged(false)
    try {
      await changeEmail(newEmail)
      await refreshProfile()
      setEmailChanged(true)
      setShowChangeEmail(false)
      setNewEmail('')
    } catch (err) {
      setChangeEmailError(
        err instanceof Error ? err.message : t('auth:somethingWentWrong'),
      )
    } finally {
      setChangingEmail(false)
    }
  }

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  if (loading || !user) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div className="card !p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="card !p-6 space-y-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-primary-muted flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {t('auth:verifyEmailWaitingTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('auth:verifyEmailWaitingDescription')}{' '}
              <span className="font-semibold text-foreground">{user.email}</span>
            </p>
          </div>
        </div>

        {resent && (
          <div className="rounded-lg bg-success-muted border border-success/30 px-4 py-2.5 text-sm text-success">
            {t('auth:verificationEmailSent')}
          </div>
        )}
        {resendError && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {resendError}
          </div>
        )}
        {emailChanged && (
          <div className="rounded-lg bg-success-muted border border-success/30 px-4 py-2.5 text-sm text-success">
            {t('auth:emailChangedSuccess', { email: user.email })}
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleResend}
            disabled={resending}
            className="btn-primary w-full"
          >
            {resending ? t('auth:pleaseWait') : t('auth:resendVerificationEmail')}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-ghost w-full"
          >
            {refreshing
              ? t('auth:pleaseWait')
              : t('auth:refreshVerificationStatus')}
          </button>

          {!showChangeEmail ? (
            <button
              onClick={() => {
                setShowChangeEmail(true)
                setEmailChanged(false)
              }}
              className="btn-ghost w-full"
            >
              {t('auth:changeEmail')}
            </button>
          ) : (
            <form
              onSubmit={handleChangeEmail}
              className="space-y-3 border-t border-border pt-3"
            >
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('auth:changeEmailDescription')}
                </p>
                <label htmlFor="verify-new-email" className="label mt-3">
                  {t('auth:email')}
                </label>
                <input
                  id="verify-new-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input-field"
                  placeholder={t('auth:emailPlaceholder')}
                />
              </div>
              {changeEmailError && (
                <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
                  {changeEmailError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={changingEmail}
                  className="btn-primary flex-1"
                >
                  {changingEmail
                    ? t('auth:pleaseWait')
                    : t('auth:changeEmailTitle')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeEmail(false)
                    setNewEmail('')
                    setChangeEmailError(null)
                  }}
                  className="btn-ghost"
                >
                  {t('common:cancel')}
                </button>
              </div>
            </form>
          )}

          <button
            onClick={handleLogout}
            className="btn-ghost w-full text-muted-foreground"
          >
            {t('common:signOut')}
          </button>
        </div>
      </div>
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
        <VerifyEmailWaiting />
      </Suspense>
    </main>
  )
}
