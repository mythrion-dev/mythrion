'use client'

import { useEffect, useState, Suspense, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription, fetchPlans, type Plan } from '@/lib/subscription-api'
import initMercadoPago, { MercadoPagoInstance } from '@mercadopago/sdk-react/esm/mercadoPago/initMercadoPago'
import CardNumber from '@mercadopago/sdk-react/esm/secureFields/cardNumber'
import SecurityCode from '@mercadopago/sdk-react/esm/secureFields/securityCode'
import ExpirationDate from '@mercadopago/sdk-react/esm/secureFields/expirationDate'
import type { FieldStyle } from '@mercadopago/sdk-react/esm/secureFields/util/types'
import Link from 'next/link'

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY

/**
 * Styles for the MP secure-field iframes.
 * Font-size 16px prevents mobile zoom on focus.
 */
const SECURE_FIELD_STYLE: FieldStyle = {
  color: '#e1e1e1',
  'font-family': "'Inter', system-ui, sans-serif",
  'font-size': '16px',
  padding: '0',
  'placeholder-color': '#71717a',
  width: '100%',
}

/**
 * CSS class shared by every secure-field wrapper div.
 * Matches the card-name <input> so all form fields look uniform.
 */
const FIELD_WRAPPER_CLASS =
  'w-full h-11 px-4 bg-surface border border-border rounded-lg flex items-center focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary relative'

/**
 * CRITICAL: Secure Fields are ALWAYS rendered (never conditional).
 *
 * The MP SDK's getInitializationDependencies compares param references on
 * every render — if any reference changes, the field unmounts + remounts,
 * destroying the internal iframe. Once destroyed, createCardToken cannot
 * communicate with the card-number iframe (postMessage to null contentWindow)
 * and the promise hangs forever.
 *
 * Instead of conditional mount, we use a CSS overlay to show loading state
 * *while* keeping the Secure Fields mounted in the DOM at all times.
 */

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useSubscription()
  const [status, setStatus] = useState<'form' | 'loading' | 'redirecting' | 'error'>('form')
  const [errorMessage, setErrorMessage] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)

  // --- Mercado Pago SDK lifecycle ---
  const [mpReady, setMpReady] = useState(false)
  const [mpError, setMpError] = useState(false)
  const mpInstanceRef = useRef<any>(null)

  // Per-field ready flags — the SDK fires onReady once the iframe is
  // mounted and the card input is interactive.
  const [cardNumberReady, setCardNumberReady] = useState(false)
  const [expirationDateReady, setExpirationDateReady] = useState(false)
  const [securityCodeReady, setSecurityCodeReady] = useState(false)
  const allFieldsReady = cardNumberReady && expirationDateReady && securityCodeReady

  // Card form state
  const [cardName, setCardName] = useState('')

  // Secure field validity trackers
  const [cardNumberValid, setCardNumberValid] = useState(false)
  const [securityCodeValid, setSecurityCodeValid] = useState(false)
  const [expirationDateValid, setExpirationDateValid] = useState(false)

  // ----- Stable callbacks (NEVER change reference) -----
  // These prevent the SDK's getInitializationDependencies from triggering
  // a remount of the iframe on every render.

  const onCardNumberValidity = useCallback(
    (e: any) => setCardNumberValid(!e?.errorMessages?.length),
    [],
  )
  const onCardNumberReady = useCallback(() => setCardNumberReady(true), [])

  const onExpirationDateValidity = useCallback(
    (e: any) => setExpirationDateValid(!e?.errorMessages?.length),
    [],
  )
  const onExpirationDateReady = useCallback(() => setExpirationDateReady(true), [])

  const onSecurityCodeValidity = useCallback(
    (e: any) => setSecurityCodeValid(!e?.errorMessages?.length),
    [],
  )
  const onSecurityCodeReady = useCallback(() => setSecurityCodeReady(true), [])

  // ----- Proactively load MP SDK -----
  useEffect(() => {
    if (!MP_PUBLIC_KEY) {
      setMpError(true)
      setErrorMessage(
        'Chave pública do Mercado Pago não configurada. ' +
          'Configure NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY nas variáveis de ambiente.',
      )
      return
    }

    initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })

    // Force-load the CDN script and create the MP instance BEFORE any Secure
    // Fields mount — otherwise the fields load the script themselves.
    MercadoPagoInstance.getInstance()
      .then((instance: any) => {
        mpInstanceRef.current = instance
        setMpReady(true)
      })
      .catch((err: unknown) => {
        console.error('Failed to load Mercado Pago SDK:', err)
        setMpError(true)
        setErrorMessage('Falha ao carregar o Mercado Pago. Recarregue a página.')
      })
  }, [])

  const planId = searchParams.get('planId')

  // ----- Fetch plan details -----
  useEffect(() => {
    if (authLoading || !planId) return
    fetchPlans()
      .then((plans) => {
        const found = plans.find((p) => p.id === planId || p.slug === planId)
        if (found) setPlan(found)
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
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setStatus('loading')
      setErrorMessage('')

      try {
        // Validate cardholder name
        if (!cardName.trim()) {
          throw new Error('Preencha o nome do titular do cartão')
        }

        // Validate secure fields are filled
        if (!cardNumberValid || !securityCodeValid || !expirationDateValid) {
          throw new Error('Preencha todos os dados do cartão corretamente')
        }

        const mp = mpInstanceRef.current
        if (!mp) {
          throw new Error('Mercado Pago SDK não foi carregado. Recarregue a página.')
        }

        // Create the card token with a timeout to prevent infinite hangs.
        // The SDK's internal postMessage to the Secure Fields iframe can
        // hang forever if the iframe was destroyed or if an adblocker blocks
        // MP's tracking endpoint.
        const tokenPromise = mp.fields.createCardToken({
          cardholderName: cardName,
        })
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tempo limite excedido ao gerar token do cartão')), 8000),
        )

        const token = await Promise.race([tokenPromise, timeoutPromise])

        if (!token || !token.id) {
          throw new Error(
            `Falha ao gerar token do cartão. Resposta: ${JSON.stringify(token)}`,
          )
        }

        const result = await createSubscription(plan?.id ?? planId ?? '', token.id)

        setStatus('redirecting')
        refresh()

        if (result.initPoint) {
          window.location.href = result.initPoint
        } else {
          router.push('/subscription/success')
        }
      } catch (err) {
        console.error('[checkout] Error:', err)
        setStatus('form')
        setErrorMessage(
          err instanceof Error ? err.message : 'Falha ao criar assinatura. Tente novamente.',
        )
      }
    },
    [cardName, cardNumberValid, securityCodeValid, expirationDateValid, plan, planId, router, refresh],
  )

  // ----- Render: loading / redirecting / error -----
  if (status === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Processando pagamento...</p>
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
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
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

  // ----- Render: form with Secure Fields (ALWAYS mounted) -----
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-background bg-pattern px-4 py-12">
      <div className="w-full max-w-lg">
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

        {/* Card form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card number — ALWAYS rendered, loading state via CSS overlay */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Número do cartão
            </label>
            <div className={FIELD_WRAPPER_CLASS}>
              <CardNumber
                placeholder="0000 0000 0000 0000"
                style={SECURE_FIELD_STYLE}
                onValidityChange={onCardNumberValidity}
                onReady={onCardNumberReady}
              />
              {!mpReady && (
                <span className="absolute inset-0 flex items-center px-4 text-sm text-muted-foreground/50 pointer-events-none">
                  {mpError ? 'Erro ao carregar' : 'Carregando...'}
                </span>
              )}
            </div>
          </div>

          {/* Card name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Nome do titular
            </label>
            <input
              type="text"
              placeholder="Nome como está no cartão"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              className="w-full h-11 px-4 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              required
            />
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Validade</label>
              <div className={FIELD_WRAPPER_CLASS}>
                <ExpirationDate
                  placeholder="MM/AA"
                  mode="short"
                  style={SECURE_FIELD_STYLE}
                  onValidityChange={onExpirationDateValidity}
                  onReady={onExpirationDateReady}
                />
                {!mpReady && (
                  <span className="absolute inset-0 flex items-center px-4 text-sm text-muted-foreground/50 pointer-events-none">
                    {mpError ? 'Erro' : 'Carregando...'}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">CVV</label>
              <div className={FIELD_WRAPPER_CLASS}>
                <SecurityCode
                  placeholder="123"
                  style={SECURE_FIELD_STYLE}
                  onValidityChange={onSecurityCodeValidity}
                  onReady={onSecurityCodeReady}
                />
                {!mpReady && (
                  <span className="absolute inset-0 flex items-center px-4 text-sm text-muted-foreground/50 pointer-events-none">
                    {mpError ? 'Erro' : 'Carregando...'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Submit button — disabled until ALL fields are interactive AND valid */}
          <button
            type="submit"
            disabled={!allFieldsReady || !cardNumberValid || !securityCodeValid || !expirationDateValid}
            className="w-full h-11 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!allFieldsReady && !mpError
              ? 'Carregando...'
              : mpError
                ? 'Erro ao carregar — recarregue a página'
                : `Assinar — R$ ${(plan ? plan.price / 100 : 0).toFixed(2)}${plan?.slug === 'annual' ? '/ano' : '/mês'}`}
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
