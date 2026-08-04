'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export default function SuccessPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { subscription, loading: subLoading, refresh } = useSubscription()
  const [message, setMessage] = useState(t('billing:processingPayment'))
  const [elapsed, setElapsed] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  // Poll for subscription status (stops on timeout or active status)
  useEffect(() => {
    if (authLoading || !user || timedOut) return

    // Poll every 3 seconds
    intervalRef.current = setInterval(async () => {
      if (subscription?.status !== 'ACTIVE' && subscription?.status !== 'AUTHORIZED') {
        await refresh()
      }
    }, 3000)

    // Timeout after 30 seconds
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [authLoading, user, refresh, timedOut, subscription?.status])

  // Track elapsed time for the message
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Update message based on elapsed time
  useEffect(() => {
    if (elapsed < 5) {
      setMessage(t('billing:processingPayment'))
    } else if (elapsed < 15) {
      setMessage(t('billing:waitingPaymentConfirmation'))
    } else if (elapsed < 25) {
      setMessage(t('billing:stillConfirmingSubscription'))
    } else {
      setMessage(t('billing:takingLonger'))
    }
  }, [elapsed, t])

  // Redirect once we have an active subscription
  useEffect(() => {
    if (subLoading || !subscription) return

    const activeStatuses = ['AUTHORIZED', 'ACTIVE']
    if (activeStatuses.includes(subscription.status)) {
      // Short delay so the user sees the success state
      const timeoutId = setTimeout(() => {
        router.replace('/dashboard')
      }, 1500)

      setMessage(t('billing:paymentConfirmedRedirecting'))

      return () => clearTimeout(timeoutId)
    }
  }, [subscription, subLoading, router, t])

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
      <div className="max-w-md text-center px-4">
        {!timedOut && !subLoading && subscription && ['AUTHORIZED', 'ACTIVE'].includes(subscription.status) ? (
          <>
            {/* Success state */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t('billing:subscriptionConfirmed')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('billing:welcomePremiumRedirect')}
            </p>
            <div className="mt-6">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          </>
        ) : timedOut ? (
          <>
            {/* Timeout state */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t('billing:stillWaitingConfirmation')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('billing:paymentProcessingPagbank')}
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={async () => {
                  await refresh()
                  setTimedOut(false)
                  setElapsed(0)
                }}
                className="btn-primary text-sm px-4 py-2"
              >
                {t('billing:checkAgain')}
              </button>
              <Link href="/dashboard" className="btn-ghost text-sm px-4 py-2">
                {t('billing:goToDashboard')}
              </Link>
            </div>
          </>
        ) : (
          <>
            {/* Loading state */}
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">{message}</p>
          </>
        )}
      </div>
    </div>
  )
}
