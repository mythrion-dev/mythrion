'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import Link from 'next/link'

export default function SuccessPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { subscription, loading: subLoading, refresh } = useSubscription()
  const [message, setMessage] = useState('Processing your payment...')
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

  // Poll for subscription status
  useEffect(() => {
    if (authLoading || !user) return

    // Poll every 3 seconds
    intervalRef.current = setInterval(async () => {
      await refresh()
    }, 3000)

    // Timeout after 30 seconds
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true)
    }, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [authLoading, user, refresh])

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
      setMessage('Processing your payment...')
    } else if (elapsed < 15) {
      setMessage('Waiting for payment confirmation...')
    } else if (elapsed < 25) {
      setMessage('Still confirming your subscription...')
    } else {
      setMessage('Taking longer than expected...')
    }
  }, [elapsed])

  // Redirect once we have an active subscription
  useEffect(() => {
    if (subLoading || !subscription) return

    const activeStatuses = ['AUTHORIZED', 'ACTIVE']
    if (activeStatuses.includes(subscription.status)) {
      // Short delay so the user sees the success state
      const t = setTimeout(() => {
        router.replace('/dashboard')
      }, 1500)

      setMessage('Payment confirmed! Redirecting...')

      return () => clearTimeout(t)
    }
  }, [subscription, subLoading, router])

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
            <h2 className="text-lg font-semibold text-foreground">Subscription confirmed!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome to Mythrion Premium. You&apos;re being redirected to the dashboard.
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
            <h2 className="text-lg font-semibold text-foreground">Still waiting for confirmation</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your payment is being processed by Mercado Pago. This may take a few minutes.
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
                Check again
              </button>
              <Link href="/dashboard" className="btn-ghost text-sm px-4 py-2">
                Go to Dashboard
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
