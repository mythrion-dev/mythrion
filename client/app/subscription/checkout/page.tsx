'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription, fetchPlans, type Plan, type CreateSubscriptionResponse } from '@/lib/subscription-api'
import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Checkout page — redirect-based Mercado Pago flow.
 *
 * 1. Fetches plan details from the URL param.
 * 2. On "Assinar", calls POST /api/subscriptions (no cardTokenId).
 * 3. Server creates a preapproval in MP and returns an init_point URL.
 * 4. User is redirected to MP's hosted checkout page.
 * 5. After payment, MP redirects back to /subscription/success.
 *
 * No credit card data is collected on this page — MP handles it securely.
 */

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useSubscription()
  const [status, setStatus] = useState<'form' | 'loading' | 'redirecting' | 'error'>('form')
  const [errorMessage, setErrorMessage] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)

  const planId = searchParams.get('planId')

  // ----- Fetch plan details -----
  useEffect(() => {
    if (authLoading || !planId) return
    fetchPlans()
      .then((plans) => {
        const found = plans.find((p) => p.id === planId || p.slug === planId)
        if (found) {
          setPlan(found)
        }
      })
      .catch(() => {})
  }, [authLoading, planId])

  // ----- Auth check -----
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?redirect=/pricing')
      return
    }
    if (!planId) {
      setStatus('error')
      setErrorMessage('Nenhum plano selecionado. Volte e escolha um plano.')
    }
  }, [authLoading, user, planId, router])

  // ----- Submit handler -----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      console.log('[checkout] Creating subscription...')

      // Create the subscription without cardTokenId — MP will return a checkout URL
      const result: CreateSubscriptionResponse = await createSubscription(
        plan?.id ?? planId ?? '',
      )

      console.log('[checkout] Subscription created:', result)

      setStatus('redirecting')
      refresh()

      // Redirect to MP's hosted checkout
      if (result.initPoint) {
        window.location.href = result.initPoint
      } else {
        throw new Error('URL de checkout não recebida do Mercado Pago')
      }
    } catch (err) {
      console.error('[checkout] Error:', err)
      setStatus('form')
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha ao criar assinatura. Tente novamente.',
      )
    }
  }

  // ----- Render: loading / redirecting / error -----
  if (status === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Preparando checkout...</p>
      </div>
    )
  }

  if (status === 'redirecting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecionando para o Mercado Pago...</p>
      </div>
    )
  }

  if (status === 'error' && !plan) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="max-w-md text-center px-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
            <svg
              className="w-6 h-6 text-red-500"
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
          </div>
          <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link href="/pricing" className="btn-ghost text-sm px-4 py-2">
              Voltar aos planos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ----- Render: form -----
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-background bg-pattern px-4 py-12">
      <div className="w-full max-w-md">
        {/* Plan summary */}
        {plan && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">Finalizar assinatura</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {plan.name} —{' '}
              <span className="text-primary font-medium">
                R$ {(plan.price / 100).toFixed(2)}
              </span>
              {plan.slug === 'monthly' ? '/mês' : '/ano'}
            </p>
          </div>
        )}

        {/* Checkout info card */}
        <div className="rounded-lg bg-surface border border-border p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-foreground font-medium">Pagamento seguro</p>
              <p className="text-xs text-muted-foreground mt-1">
                Você será redirecionado para o ambiente seguro do Mercado Pago para realizar o pagamento.
                Seus dados de cartão são processados diretamente pelo Mercado Pago.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-foreground font-medium">Cobrança recorrente</p>
              <p className="text-xs text-muted-foreground mt-1">
                Após a confirmação, sua assinatura será ativada automaticamente e as renovações
                serão processadas mensalmente/anualmente.
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="mt-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* Submit button */}
        <form onSubmit={handleSubmit} className="mt-6">
          <button
            type="submit"
            className="w-full h-12 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Assinar — R$ {(plan ? plan.price / 100 : 0).toFixed(2)}
            {plan?.slug === 'annual' ? '/ano' : plan?.slug === 'monthly' ? '/mês' : ''}
          </button>
        </form>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar aos planos
          </Link>
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
