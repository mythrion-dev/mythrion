'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription, fetchPlans, type Plan } from '@/lib/subscription-api'
import Link from 'next/link'
import { initMercadoPago, getInstallments } from '@mercadopago/sdk-react'
import createCardToken from '@mercadopago/sdk-react/esm/coreMethods/cardToken/create'

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

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useSubscription()
  const [status, setStatus] = useState<'form' | 'loading' | 'redirecting' | 'error'>('form')
  const [errorMessage, setErrorMessage] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [mpReady, setMpReady] = useState(false)

  // Card form state
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [installments, setInstallments] = useState(1)
  const [installmentOptions, setInstallmentOptions] = useState<Array<{ value: number; label: string }>>([])

  const planId = searchParams.get('planId')

  // Init MP SDK
  useEffect(() => {
    if (!MP_PUBLIC_KEY) {
      console.warn('NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY is not set')
      setMpReady(true) // Proceed anyway — might fail later with clear error
      return
    }

    try {
      initMercadoPago(MP_PUBLIC_KEY)
      setMpReady(true)
    } catch (err) {
      console.error('Failed to init Mercado Pago:', err)
      setMpReady(true) // Still let the user try
    }
  }, [])

  // Fetch plan details
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

  // Auth check
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setStatus('loading')
      setErrorMessage('')

      try {
        // Validate card
        if (!cardNumber.trim() || !cardName.trim() || !cardExpiry.trim() || !cardCvv.trim()) {
          throw new Error('Preencha todos os dados do cartão')
        }

        // Parse expiry
        const [expMonth, expYear] = cardExpiry.split('/')
        if (!expMonth || !expYear) throw new Error('Data de validade inválida')

        // Create card token via MercadoPago.js
        let cardTokenId: string | undefined

        if (MP_PUBLIC_KEY) {
          const token = await createCardToken({
            cardNumber: cardNumber.replace(/\s/g, ''),
            cardholderName: cardName,
            cardExpirationMonth: expMonth,
            cardExpirationYear: expYear.length === 2 ? `20${expYear}` : expYear,
            securityCode: cardCvv,
          })

          if (!token?.id) throw new Error('Falha ao gerar token do cartão. Tente novamente.')
          cardTokenId = token.id
        }

        // Create subscription
        const result = await createSubscription(plan?.id ?? planId ?? '', cardTokenId)

        setStatus('redirecting')
        refresh()

        // Redirect to MP checkout (for 3DS) or go directly to success
        if (result.initPoint) {
          window.location.href = result.initPoint
        } else {
          router.push('/subscription/success')
        }
      } catch (err) {
        setStatus('form')
        setErrorMessage(
          err instanceof Error ? err.message : 'Falha ao criar assinatura. Tente novamente.',
        )
      }
    },
    [cardNumber, cardName, cardExpiry, cardCvv, plan, planId, router, refresh],
  )

  // Auto-fill test card for development
  const fillTestCard = useCallback((testCard: TestCard) => {
    setCardNumber(testCard.number)
    setCardName('Test User')
    setCardExpiry(testCard.expiry)
    setCardCvv(testCard.cvv)
  }, [])

  // Show payment pending states
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

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-background bg-pattern px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Plan summary */}
        {plan && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">Finalizar assinatura</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {plan.name} — <span className="text-primary font-medium">R$ {(plan.price / 100).toFixed(2)}</span>
              {plan.slug === 'monthly' ? '/mês' : '/ano'}
            </p>
          </div>
        )}

        {/* Card form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Número do cartão</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              required
            />
          </div>

          {/* Card name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nome do titular</label>
            <input
              type="text"
              placeholder="Nome como está no cartão"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              required
            />
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Validade</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM/AA"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">CVV</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="123"
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                required
              />
            </div>
          </div>

          {/* Installments */}
          {installmentOptions.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Parcelas</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none"
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

          {/* Error */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 px-6 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity"
          >
            {`Assinar — R$ ${(plan ? plan.price / (installments || 1) : 0).toFixed(2)}${installments > 1 ? ` × ${installments}` : ''}`}
          </button>
        </form>

        {/* Test cards (only in dev) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 rounded-lg bg-surface border border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium">🧪 Cartões de teste (ambiente dev)</p>
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
