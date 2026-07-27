'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription, fetchPlans, type Plan } from '@/lib/subscription-api'
import initMercadoPago, { MercadoPagoInstance } from '@mercadopago/sdk-react/esm/mercadoPago/initMercadoPago'
import CardNumber from '@mercadopago/sdk-react/esm/secureFields/cardNumber'
import SecurityCode from '@mercadopago/sdk-react/esm/secureFields/securityCode'
import ExpirationDate from '@mercadopago/sdk-react/esm/secureFields/expirationDate'
import createCardToken from '@mercadopago/sdk-react/esm/secureFields/createCardToken'
import type { FieldStyle } from '@mercadopago/sdk-react/esm/secureFields/util/types'
import Link from 'next/link'

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY

// Test cards for MP sandbox
interface TestCard {
  label: string
  number: string
  cvv: string
  expiry: string
}

const TEST_CARDS: TestCard[] = [
  { label: 'Mastercard', number: '5031433215406351', cvv: '123', expiry: '12/2028' },
  { label: 'Visa', number: '4235647728025682', cvv: '123', expiry: '12/2028' },
  { label: 'American Express', number: '3753651246888671', cvv: '1234', expiry: '12/2028' },
]

/**
 * Styles applied inside the MP secure-field iframe (the <input> element).
 * Font-size 16px prevents mobile zoom on focus.
 * No height here — the iframe is sized by the container div.
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
 * CSS class shared by every secure-field wrapper.
 * Matches the card-name <input> so all form fields look uniform.
 */
const FIELD_WRAPPER_CLASS =
  'w-full h-11 px-4 bg-surface border border-border rounded-lg flex items-center focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary'

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

  // Per-field ready flag — the SDK fires onReady once the iframe is mounted
  // and the card input is interactive. We gate the submit button on ALL three.
  const [cardNumberReady, setCardNumberReady] = useState(false)
  const [expirationDateReady, setExpirationDateReady] = useState(false)
  const [securityCodeReady, setSecurityCodeReady] = useState(false)

  // Card form state
  const [cardName, setCardName] = useState('')
  const [installments, setInstallments] = useState(1)
  const [installmentOptions, setInstallmentOptions] = useState<
    Array<{ value: number; label: string }>
  >([])

  // Secure field validity trackers
  const [cardNumberValid, setCardNumberValid] = useState(false)
  const [securityCodeValid, setSecurityCodeValid] = useState(false)
  const [expirationDateValid, setExpirationDateValid] = useState(false)

  // BIN (first 6 digits) captured from the card — used for installments lookup
  const [bin, setBin] = useState<string | null>(null)

  // All secure fields are mounted and the user can interact with them
  const allFieldsReady = cardNumberReady && expirationDateReady && securityCodeReady

  // ----- Stable callbacks (useCallback with [] deps) -----
  // These NEVER change reference, so the secure-field internal useEffect
  // won't unmount+remount the iframe on every render.

  const onCardNumberValidity = useCallback(
    (e: any) => setCardNumberValid(!e?.errorMessages?.length),
    [],
  )
  const onCardNumberBin = useCallback((e: any) => setBin(e?.bin ?? null), [])
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

  const planId = searchParams.get('planId')

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

    // 1. Store config (key + options) in the singleton
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })

    // 2. Force-load the CDN script and create the MP instance.
    //    Without this explicit call, the SDK only loads when a secure field
    //    mounts — but we gate secure fields behind mpReady, creating a
    //    deadlock where nothing ever triggers the load.
    MercadoPagoInstance.getInstance()
      .then(() => setMpReady(true))
      .catch((err: unknown) => {
        console.error('Failed to load Mercado Pago SDK:', err)
        setMpError(true)
        setErrorMessage('Falha ao carregar o Mercado Pago. Recarregue a página.')
      })
  }, [])

  // ----- Fetch plan details -----
  useEffect(() => {
    if (authLoading || !planId) return
    fetchPlans()
      .then((plans) => {
        const found = plans.find((p) => p.id === planId || p.slug === planId)
        if (found) {
          setPlan(found)
          // Generate installment options based on plan price
          const maxInstallments = found.slug === 'annual' ? 12 : 1
          const options = []
          for (let i = 1; i <= maxInstallments; i++) {
            const installmentValue = found.price / i
            options.push({
              value: i,
              label:
                i === 1
                  ? `À vista — R$ ${(found.price / 100).toFixed(2)}`
                  : `${i}x de R$ ${(installmentValue / 100).toFixed(2)} sem juros`,
            })
          }
          setInstallmentOptions(options)
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

        console.log('[checkout] Creating card token...')
        const token = await createCardToken({ cardholderName: cardName })
        console.log('[checkout] Card token response:', token)

        if (!token || !token.id) {
          throw new Error(
            `Falha ao gerar token do cartão. Resposta: ${JSON.stringify(token)}`,
          )
        }

        console.log('[checkout] Creating subscription...')
        const result = await createSubscription(plan?.id ?? planId ?? '', token.id)
        console.log('[checkout] Subscription result:', result)

        setStatus('redirecting')
        refresh()

        // Redirect to MP checkout (for 3DS) or go directly to success
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
    [
      cardName,
      cardNumberValid,
      securityCodeValid,
      expirationDateValid,
      plan,
      planId,
      router,
      refresh,
    ],
  )

  // Auto-fill test card — only sets cardholder name since secure fields
  // handle the card number, CVV, and expiry; the user types them manually
  const fillTestCard = useCallback((_testCard: TestCard) => {
    setCardName('Test User')
  }, [])

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
          {/* ----- Card number (secure field) ----- */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Número do cartão
            </label>
            <div className={FIELD_WRAPPER_CLASS}>
              {mpReady ? (
                <CardNumber
                  placeholder="0000 0000 0000 0000"
                  style={SECURE_FIELD_STYLE}
                  onValidityChange={onCardNumberValidity}
                  onBinChange={onCardNumberBin}
                  onReady={onCardNumberReady}
                />
              ) : (
                <span className="text-sm text-muted-foreground/50 w-full">
                  {mpError ? 'Erro ao carregar' : 'Carregando...'}
                </span>
              )}
            </div>
          </div>

          {/* ----- Card name ----- */}
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

          {/* ----- Expiry + CVV ----- */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Validade</label>
              <div className={FIELD_WRAPPER_CLASS}>
                {mpReady ? (
                  <ExpirationDate
                    placeholder="MM/AA"
                    mode="short"
                    style={SECURE_FIELD_STYLE}
                    onValidityChange={onExpirationDateValidity}
                    onReady={onExpirationDateReady}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground/50 w-full">
                    {mpError ? 'Erro' : 'Carregando...'}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">CVV</label>
              <div className={FIELD_WRAPPER_CLASS}>
                {mpReady ? (
                  <SecurityCode
                    placeholder="123"
                    style={SECURE_FIELD_STYLE}
                    onValidityChange={onSecurityCodeValidity}
                    onReady={onSecurityCodeReady}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground/50 w-full">
                    {mpError ? 'Erro' : 'Carregando...'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ----- Installments ----- */}
          {installmentOptions.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Parcelas</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="w-full h-11 px-4 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.25rem',
                }}
              >
                {installmentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ----- Error ----- */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* ----- Submit ----- */}
          <button
            type="submit"
            disabled={!allFieldsReady && !mpError}
            className="w-full h-11 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allFieldsReady || mpError
              ? mpError
                ? 'Erro ao carregar — recarregue a página'
                : `Assinar — R$ ${(plan ? plan.price / (installments || 1) : 0).toFixed(2)}${installments > 1 ? ` × ${installments}` : ''}`
              : 'Carregando...'}
          </button>
        </form>

        {/* ----- Test cards (only in dev) ----- */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 rounded-lg bg-surface border border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              🧪 Cartões de teste (ambiente dev)
            </p>
            <p className="text-xs text-muted-foreground/60 mb-2">
              Digite os dados do cartão manualmente nos campos seguros acima. Apenas o nome é
              preenchido automaticamente.
            </p>
            <div className="flex flex-wrap gap-2">
              {TEST_CARDS.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => fillTestCard(card)}
                  className="text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {card.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
