'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription, fetchPlans, type Plan } from '@/lib/subscription-api'
import Link from 'next/link'

/* ---------- component ---------- */
function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useSubscription()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [planLoading, setPlanLoading] = useState(true)

  // State: 'loading' | 'ready' | 'creating' | 'redirecting' | 'error'
  const [state, setState] = useState<'loading' | 'ready' | 'creating' | 'redirecting' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const planId = searchParams.get('planId')

  // ----- Auth & param check -----
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?redirect=/subscription/checkout?planId=' + (planId ?? ''))
      return
    }
    if (!planId) {
      setState('error')
      setErrorMessage('Nenhum plano selecionado. Volte e escolha um plano.')
      return
    }
  }, [authLoading, user, planId, router])

  // ----- Fetch plan details -----
  useEffect(() => {
    if (!planId) return
    fetchPlans()
      .then((plans) => {
        const found = plans.find((p) => p.id === planId || p.slug === planId)
        if (found) {
          setPlan(found)
          setState('ready')
        } else {
          setState('error')
          setErrorMessage('Plano não encontrado.')
        }
      })
      .catch(() => {
        setState('error')
        setErrorMessage('Erro ao carregar dados do plano.')
      })
      .finally(() => setPlanLoading(false))
  }, [planId])

  // ----- Handle subscribe -----
  const handleSubscribe = useCallback(async () => {
    if (!planId) return

    setState('creating')
    setErrorMessage('')

    try {
      // Create subscription on server — no card token needed
      // MP will return an init_point URL for the hosted checkout page
      const result = await createSubscription(planId)

      setState('redirecting')

      if (result.initPoint) {
        // Redirect to Mercado Pago Checkout Pro
        window.location.href = result.initPoint
      } else {
        // No init_point — should not happen, but handle gracefully
        router.push('/subscription/success')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao criar assinatura. Tente novamente.'
      console.error('[checkout] Error:', message)

      // Check if MP returned card_token_id is required — means the plan
      // needs explicit card tokenization. Fall through to error.
      setState('error')
      setErrorMessage(message)
    }
  }, [planId, router])

  // ----- Creating / Redirecting states -----
  if (state === 'creating' || state === 'redirecting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <h2 className="mt-6 text-lg font-semibold text-foreground">
          {state === 'creating'
            ? 'Preparando assinatura...'
            : 'Redirecionando para o Mercado Pago...'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
          {state === 'creating'
            ? 'Aguarde enquanto configuramos sua assinatura.'
            : 'Você será redirecionado para o ambiente seguro do Mercado Pago para autorizar o pagamento.'}
        </p>
      </div>
    )
  }

  // ----- Error state -----
  if (state === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="max-w-md text-center px-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={handleSubscribe}
              className="px-6 py-2 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity"
            >
              Tentar novamente
            </button>
            <Link
              href="/pricing"
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Voltar aos planos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ----- Ready state — show plan info + subscribe button -----
  const formattedPlanPrice = plan ? `R$ ${(plan.price / 100).toFixed(2)}` : ''

  return (
    <div className="flex-1 flex items-start justify-center bg-background bg-pattern px-4 py-12 min-h-screen">
      <div className="w-full max-w-md">
        {/* Page title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Finalizar assinatura</h1>
        </div>

        {/* Plan summary card */}
        <div className="bg-surface border border-border rounded-xl p-6">
          {plan && (
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">{plan.name}</h2>
              <p className="mt-2 text-3xl font-bold text-primary">
                {formattedPlanPrice}
                <span className="text-base font-normal text-muted-foreground">
                  {plan.slug === 'monthly' ? '/mês' : '/ano'}
                </span>
              </p>
              {plan.slug === 'annual' && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Equivalente a R$ 100,00/mês
                </p>
              )}
            </div>
          )}

          {/* Features list */}
          <ul className="space-y-3 mb-6 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Acesso completo à plataforma
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Conteúdo exclusivo
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Suporte prioritário
            </li>
          </ul>

          {/* Subscribe button */}
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={planLoading}
            className="w-full py-3 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {planLoading
              ? 'Carregando...'
              : `Assinar ${formattedPlanPrice}${plan?.slug === 'monthly' ? '/mês' : '/ano'}`}
          </button>
        </div>

        {/* Security note */}
        <p className="mt-4 text-xs text-muted-foreground text-center leading-relaxed">
          Pagamento processado de forma segura pelo{' '}
          <span className="text-foreground">Mercado Pago</span>.
          Você será redirecionado para o ambiente seguro deles.
        </p>

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
