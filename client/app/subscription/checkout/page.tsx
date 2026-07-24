'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription } from '@/lib/subscription-api'
import Link from 'next/link'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useSubscription()
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const planId = searchParams.get('planId')

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace('/login?redirect=/pricing')
      return
    }

    if (!planId) {
      setStatus('error')
      setErrorMessage('No plan selected. Please go back and choose a plan.')
      return
    }

    let cancelled = false

    const safePlanId = planId

    async function checkout() {
      try {
        const result = await createSubscription(safePlanId)
        if (cancelled) return
        setStatus('redirecting')
        // Refresh subscription state in the background
        refresh()
        // Redirect to Mercado Pago Checkout Pro
        window.location.href = result.initPoint
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to create subscription. Please try again.',
        )
      }
    }

    checkout()

    return () => {
      cancelled = true
    }
  }, [authLoading, user, planId, router, refresh])

  if (status === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Preparing your checkout...</p>
      </div>
    )
  }

  if (status === 'redirecting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to Mercado Pago...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
      <div className="max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/pricing" className="btn-ghost text-sm px-4 py-2">
            Back to plans
          </Link>
          <button
            onClick={() => {
              setStatus('loading')
              setErrorMessage('')
              // Re-trigger by re-mounting the effect — use a key approach
              window.location.reload()
            }}
            className="btn-primary text-sm px-4 py-2"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-screen bg-background bg-pattern">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
