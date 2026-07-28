'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription, fetchPlans, type Plan } from '@/lib/subscription-api'
import Link from 'next/link'

/* ---------- helpers ---------- */
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function isValidMonth(m: string): boolean {
  const n = parseInt(m, 10)
  return !Number.isNaN(n) && n >= 1 && n <= 12
}

function isValidCvv(len: number): boolean {
  return len >= 3 && len <= 4
}

interface MpCardTokenResponse {
  id: string
  public_key: string
  first_six_digits: string
  last_four_digits: string
  status: string
  card_number_length: number
  expiration_month: number
  expiration_year: number
  cardholder: { identification: { number: string; type: string }; name: string }
}

/**
 * Create a card token by calling the Mercado Pago REST API directly.
 * This bypasses the SDK entirely (no iframes, no postMessage, no adblocker
 * interference from mer cadolibre.com/tracks tracking).
 *
 * Card data goes browser → api.mercadopago.com — never touches our server.
 */
async function createMpCardToken(
  publicKey: string,
  cardNumber: string,
  cardholderName: string,
  expMonth: string,
  expYear: string,
  securityCode: string,
): Promise<MpCardTokenResponse> {
  const res = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_number: cardNumber.replace(/\s/g, ''),
        cardholder: { name: cardholderName.trim() },
        security_code: securityCode.trim(),
        expiration_month: parseInt(expMonth, 10),
        expiration_year: parseInt(expYear, 10),
      }),
    },
  )

  const data = await res.json()

  if (!res.ok) {
    const message =
      data?.message || data?.error || `MP card token error (${res.status})`
    throw new Error(message)
  }

  if (!data?.id) {
    console.error('[checkout] Unexpected card token response:', data)
    throw new Error('Resposta inesperada do Mercado Pago. Tente novamente.')
  }

  return data as MpCardTokenResponse
}

/* ---------- component ---------- */
function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useSubscription()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [planLoading, setPlanLoading] = useState(true)

  // Form fields
  const [cardNumber, setCardNumber] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [securityCode, setSecurityCode] = useState('')

  // Submission
  const [step, setStep] = useState<'form' | 'tokenizing' | 'creating' | 'redirecting' | 'error'>('form')
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

  // ----- Handle submit -----
  const handleSubmit = useCallback(async () => {
    // Front-end validation
    if (!cardNumber.trim()) {
      setErrorMessage('Informe o número do cartão.')
      setStep('error')
      return
    }
    if (!cardholderName.trim()) {
      setErrorMessage('Informe o nome do titular.')
      setStep('error')
      return
    }
    if (!expiryMonth.trim() || !expiryYear.trim()) {
      setErrorMessage('Informe a data de validade.')
      setStep('error')
      return
    }
    if (!securityCode.trim()) {
      setErrorMessage('Informe o código de segurança (CVV).')
      setStep('error')
      return
    }

    if (!isValidMonth(expiryMonth)) {
      setErrorMessage('Mês de validade inválido (use 01–12).')
      setStep('error')
      return
    }
    if (!isValidCvv(securityCode.replace(/\D/g, '').length)) {
      setErrorMessage('CVV inválido (3 ou 4 dígitos).')
      setStep('error')
      return
    }

    const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY
    if (!publicKey) {
      setErrorMessage('Chave pública do Mercado Pago não configurada.')
      setStep('error')
      return
    }

    setStep('tokenizing')
    setErrorMessage('')

    try {
      // 1. Tokenize card — direct REST call to MP API, no SDK involved
      const cardToken = await createMpCardToken(
        publicKey,
        cardNumber,
        cardholderName,
        expiryMonth,
        expiryYear.length === 2 ? `20${expiryYear}` : expiryYear,
        securityCode,
      )

      console.log('[checkout] Card token created:', {
        id: cardToken.id,
        firstSix: cardToken.first_six_digits,
        lastFour: cardToken.last_four_digits,
        status: cardToken.status,
      })

      setStep('creating')

      // 2. Create subscription on server with card_token_id
      const result = await createSubscription(planId!, cardToken.id)

      setStep('redirecting')
      refresh()

      if (result.initPoint) {
        // 3. Redirect to Mercado Pago checkout
        setTimeout(() => {
          window.location.href = result.initPoint
        }, 500)
      } else {
        router.push('/subscription/success')
      }
    } catch (err: unknown) {
      console.error('[checkout] Error:', err)
      setStep('form') // go back to form so user can retry
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha ao processar pagamento. Tente novamente.',
      )
    }
  }, [cardNumber, cardholderName, expiryMonth, expiryYear, securityCode, planId, router, refresh])

  // ------ Processing states (tokenizing / creating / redirecting) -----
  if (step === 'tokenizing' || step === 'creating' || step === 'redirecting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <h2 className="mt-6 text-lg font-semibold text-foreground">
          {step === 'tokenizing'
            ? 'Processando cartão...'
            : step === 'creating'
              ? 'Criando assinatura...'
              : 'Redirecionando para o Mercado Pago...'}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
          {step === 'tokenizing'
            ? 'Seus dados estão sendo enviados de forma segura para o Mercado Pago.'
            : step === 'creating'
              ? 'Aguarde enquanto finalizamos sua assinatura.'
              : 'Você será redirecionado para o ambiente seguro do Mercado Pago.'}
        </p>
      </div>
    )
  }

  // ----- Error state before any form data is entered -----
  if (step === 'error' && !cardNumber && !cardholderName && !expiryMonth && !expiryYear && !securityCode) {
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
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity"
            >
              Recarregar
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

  // ----- Card form -----
  const formattedPlanPrice = plan ? `R$ ${(plan.price / 100).toFixed(2)}` : ''
  const showError = step === 'error' && errorMessage

  return (
    <div className="flex-1 flex items-start justify-center bg-background bg-pattern px-4 py-12 min-h-screen">
      <div className="w-full max-w-md">
        {/* Plan summary */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Finalizar assinatura</h1>
          {plan && (
            <p className="mt-2 text-sm text-muted-foreground">
              {plan.name} —{' '}
              <span className="text-primary font-medium">{formattedPlanPrice}</span>
              {plan.slug === 'monthly' ? '/mês' : '/ano'}
            </p>
          )}
        </div>

        {/* Card form */}
        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
          {/* Card number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Número do cartão
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              disabled={step !== 'form'}
              className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 text-sm tracking-wider"
            />
          </div>

          {/* Cardholder name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Nome do titular
            </label>
            <input
              type="text"
              placeholder="Como está no cartão"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              disabled={step !== 'form'}
              className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 text-sm uppercase"
            />
          </div>

          {/* Expiry month + year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Mês
              </label>
              <select
                value={expiryMonth}
                onChange={(e) => setExpiryMonth(e.target.value)}
                disabled={step !== 'form'}
                className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 text-sm"
              >
                <option value="">MM</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const v = String(i + 1).padStart(2, '0')
                  return (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Ano
              </label>
              <select
                value={expiryYear}
                onChange={(e) => setExpiryYear(e.target.value)}
                disabled={step !== 'form'}
                className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 text-sm"
              >
                <option value="">AAAA</option>
                {Array.from({ length: 15 }, (_, i) => {
                  const v = String(new Date().getFullYear() + i)
                  return (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          {/* CVV */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              CVV
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              disabled={step !== 'form'}
              className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 text-sm"
            />
          </div>

          {/* Inline error */}
          {showError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-500">
              {errorMessage}
              <button
                onClick={() => {
                  setStep('form')
                  setErrorMessage('')
                }}
                className="ml-2 underline hover:no-underline"
              >
                OK
              </button>
            </div>
          )}

          {/* Submit button */}
          <button
            type="button"
            onClick={() => {
              setStep('form')
              setErrorMessage('')
              requestAnimationFrame(() => handleSubmit())
            }}
            disabled={planLoading || step !== 'form'}
            className="w-full py-3 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {planLoading
              ? 'Carregando...'
              : `Assinar ${formattedPlanPrice}${plan?.slug === 'monthly' ? '/mês' : '/ano'}`}
          </button>
        </div>

        {/* Security note */}
        <p className="mt-4 text-xs text-muted-foreground text-center leading-relaxed">
          Seus dados de cartão são enviados diretamente ao{' '}
          <span className="text-foreground">Mercado Pago</span> e nunca passam pelos
          nossos servidores.
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
