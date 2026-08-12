'use client'

import { useSubscription } from '@/lib/subscription-context'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Dismissible banner shown when the user's subscription is in GRACE status.
 * Displays the remaining days to update payment method.
 * Hidden for admins / early-access users — their access is not paywalled.
 */
export function GracePeriodBanner() {
  const { subscription } = useSubscription()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)

  useEffect(() => {
    if (subscription?.status !== 'GRACE' || !subscription.graceEndsAt) {
      setDaysLeft(null)
      return
    }

    function calcDays() {
      if (!subscription?.graceEndsAt) return
      const now = Date.now()
      const graceEnd = new Date(subscription.graceEndsAt).getTime()
      const diff = graceEnd - now
      setDaysLeft(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))))
    }

    calcDays()

    // Recalculate every minute
    const interval = setInterval(calcDays, 60_000)
    return () => clearInterval(interval)
  }, [subscription])

  if (
    !subscription?.status ||
    subscription.status !== 'GRACE' ||
    dismissed ||
    user?.isAdmin === true ||
    user?.isEarlyAccess === true
  ) {
    return null
  }

  return (
    <div className="mx-8 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Warning icon */}
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {t('common:paymentIssueDetected')}
          </p>
          <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
            {daysLeft === null || daysLeft === 0
              ? t('common:gracePeriodEnded')
              : t('common:paymentFailedDays', { count: daysLeft })}
          </p>
          <div className="mt-2 flex gap-3">
            <Link
              href="/dashboard/subscription"
              className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline underline-offset-2"
            >
              {t('common:updatePaymentMethod')}
            </Link>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
          aria-label={t('common:dismiss')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
