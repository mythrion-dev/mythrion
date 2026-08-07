'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import { resendVerification } from '@/lib/auth-api'

/**
 * Banner shown on the dashboard until the account email is verified. Hides
 * automatically (no refresh) when verification succeeds — either in this tab
 * or another one, via BroadcastChannel.
 */
export function VerificationBanner() {
  const { t } = useTranslation()
  const { user, refreshProfile } = useAuth()
  const unverified = user ? user.emailVerified === false : false
  const unverifiedRef = useRef(unverified)
  unverifiedRef.current = unverified

  const [resending, setResending] = useState(false)
  const [sent, setSent] = useState(false)

  // Refetch when the user returns to the tab so a verification performed in
  // another window surfaces without a manual refresh.
  useEffect(() => {
    function refreshIfUnverified() {
      if (unverifiedRef.current) refreshProfile()
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') refreshIfUnverified()
    }
    window.addEventListener('focus', refreshIfUnverified)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', refreshIfUnverified)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshProfile])

  // A verification completed in another tab posts this channel; listening here
  // lets the banner disappear without a refresh.
  useEffect(() => {
    let channel: BroadcastChannel | null = null
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('mythrion:email-verified')
        channel.onmessage = () => refreshProfile()
      }
    } catch {
      // BroadcastChannel unavailable in embedded webviews — the focus/visibility
      // listener above still catches verification.
    }
    return () => channel?.close()
  }, [refreshProfile])

  async function handleResend() {
    if (!user?.email || resending) return
    setResending(true)
    setSent(false)
    try {
      await resendVerification(user.email)
      setSent(true)
    } catch (err) {
      // No persistent error surface in the banner; the button re-enables and
      // the user can retry. A real failure is surfaced in the reset flow too.
      console.error('Failed to resend verification email', err)
    } finally {
      setResending(false)
    }
  }

  if (!unverified) return null

  return (
    <div className="mx-8 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
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

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {t('auth:verifyEmailBannerTitle')}
          </p>
          <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
            {t('auth:verifyEmailBannerDescription')}
          </p>
          {sent && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {t('auth:verificationEmailSent')}
            </p>
          )}
          <div className="mt-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline underline-offset-2 disabled:opacity-60 transition-colors"
            >
              {resending ? t('auth:pleaseWait') : t('auth:resendVerificationEmail')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
