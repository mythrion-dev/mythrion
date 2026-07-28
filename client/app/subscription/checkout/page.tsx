'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription, fetchPlans, type Plan } from '@/lib/subscription-api'
import Link from 'next/link'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useSubscription()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planLoading, setPlanLoading] = useState(true)
  const [step, setStep] = useState<'idle' | 'creating' | 'redirecting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const planId = searchParams.get('planId')

  // ----- Auth check -----
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login?redirect=/pricing')
      return
    }
    if (!planId) {
      setStep('error')
      setErrorMessage('Nenhum plano selecionado. Volte e escolha um plano.')
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
        } else {
          setStep('error')
          setErrorMessage('Plano não encontrado.')
        }
      })
      .catch(() => {
        setStep('error')
        setErrorMessage('Erro ao carregar dados do plano.')
      })
      .finally(() => setPlanLoading(false))
  }, [planId])

  // ----- Create subscription automatically when ready -----
  useEffect(() => {
    if (authLoading || planLoading || step !== 'idle' || !plan || !user) return

    setStep('creating')

    createSubscription(plan.id)
      .then((result) => {
        setStep('redirecting')
        refresh()

        if (result.initPoint) {
          // Small delay so the user sees the "redirecionando" message before navigation
          setTimeout(() => {
            window.location.href = result.initPoint
          }, 500)
        } else {
          router.push('/subscription/success')
        }
      })
      .catch((err: unknown) => {
        console.error('[checkout] Error creating subscription:', err)
        setStep('error')
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Falha ao criar assinatura. Tente novamente.',
        )
      })
  }, [authLoading, planLoading, step, plan, user, planId, router, refresh])

  // ----- Loading / creating / redirecting states -----
  if (step === 'creating' || step === 'redirecting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <h2 className="mt-6 text-lg font-semibold text-foreground">
          {step === 'creating'
            ? 'Preparando sua assinatura...'
            : 'Redirecionando para o Mercado Pago...'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
          {step === 'creating'
            ? 'Aguarde um momento enquanto configuramos o pagamento.'
            : 'Você será redirecionado para o ambiente seguro do Mercado Pago para finalizar o pagamento.'}
        </p>
      </div>
    )
  }

  // ----- Error state -----
  if (step === 'error') {
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
              onClick={() => setStep('idle')}
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

  // ----- Initial state (before subscription creation fires) -----
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-background bg-pattern px-4 py-12">
      <div className="w-full max-w-lg text-center">
        {plan && (
          <>
            <h1 className="text-2xl font-bold text-foreground">Finalizar assinatura</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {plan.name} —{' '}
              <span className="text-primary font-medium">
                R$ {(plan.price / 100).toFixed(2)}
              </span>
              {plan.slug === 'monthly' ? '/mês' : '/ano'}
            </p>
          </>
        )}

        <div className="mt-8 p-6 bg-surface border border-border rounded-xl">
          <div className="w-8 h-8 mx-auto border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="mt-4 text-sm text-muted-foreground">
            {planLoading ? 'Carregando dados do plano...' : 'Iniciando processo de assinatura...'}
          </p>
        </div>

        <div className="mt-6">
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
