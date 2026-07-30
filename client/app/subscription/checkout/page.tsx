'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { createSubscription, fetchPlans, type Plan } from '@/lib/subscription-api'
import Link from 'next/link'

/* ---------- helper: price display ---------- */
function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

/* ---------- PagSeguro encryption script loader ---------- */
function usePagBankEncryption(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY
    if (!publicKey) {
      setReady(true) // No encryption configured — proceed without it
      return
    }

    // Check if already loaded
    if ((window as any).PagSeguro?.encryptCard) {
      setReady(true)
      return
    }

    // Load PagSeguro encryption SDK from CDN
    const script = document.createElement('script')
    script.src = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js'
    script.async = true
    script.onload = () => {
      setReady(true)
    }
    script.onerror = () => {
      console.error('[checkout] Failed to load PagSeguro encryption SDK')
      setReady(true) // Proceed without — error will be caught at submit time
    }
    document.head.appendChild(script)

    return () => {
      // No cleanup needed — script stays in DOM
    }
  }, [])

  return ready
}

/* ---------- component ---------- */
function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refresh } = useSubscription()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [planLoading, setPlanLoading] = useState(true)

  // Card form state
  const [payerName, setPayerName] = useState('')
  const [payerDocument, setPayerDocument] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [formErrors, setFormErrors] = useState<{ name?: string; document?: string; card?: string }>({})

  // PagBank encryption
  const pgReady = usePagBankEncryption()
  const pgPublicKey = process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY

  // State: 'form' | 'creating' | 'success' | 'error'
  const [state, setState] = useState<'form' | 'creating' | 'success' | 'error'>('form')
  const [errorMessage, setErrorMessage] = useState('')

  const planId = searchParams.get('planId')

  // ----- CPF mask -----
  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  }

  // Card expiry mask
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

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

  // ----- Validate form -----
  const validate = useCallback((): boolean => {
    const errors: { name?: string; document?: string; card?: string } = {}

    if (!payerName.trim() || payerName.trim().length < 3) {
      errors.name = 'Digite seu nome completo.'
    }

    const digits = payerDocument.replace(/\D/g, '')
    if (digits.length !== 11) {
      errors.document = 'Digite um CPF válido (11 dígitos).'
    }

    if (pgPublicKey) {
      if (cardNumber.replace(/\D/g, '').length < 13) {
        errors.card = 'Número do cartão inválido.'
      }
      if (cardExpiry.replace(/\D/g, '').length < 4) {
        errors.card = 'Data de validade inválida.'
      }
      if (cardCvv.replace(/\D/g, '').length < 3) {
        errors.card = 'CVV inválido.'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [payerName, payerDocument, pgPublicKey, cardNumber, cardExpiry, cardCvv])

  // ----- Encrypt card using PagSeguro -----
  const encryptCard = useCallback((): string => {
    if (!pgPublicKey) {
      throw new Error('PagBank public key not configured')
    }

    const pg = (window as any).PagSeguro
    if (!pg?.encryptCard) {
      throw new Error('SDK de criptografia PagBank não carregado. Tente novamente.')
    }

    const [expMonth, expYear] = cardExpiry.split('/')
    const result = pg.encryptCard({
      publicKey: pgPublicKey,
      holder: payerName.trim(),
      number: cardNumber.replace(/\s/g, ''),
      expMonth: expMonth || '',
      expYear: expYear ? `20${expYear}` : '',
      securityCode: cardCvv,
    })

    if (result.hasErrors) {
      const msgs = (result.errors || []).map((e: { message: string }) => e.message).join(' ')
      throw new Error(`Erro na criptografia: ${msgs || 'Dados inválidos do cartão.'}`)
    }

    return result.encryptedCard
  }, [pgPublicKey, cardNumber, cardExpiry, cardCvv, payerName])

  // ----- Handle subscribe -----
  const handleSubscribe = useCallback(async () => {
    if (!validate()) return
    if (!planId || !plan) return

    setErrorMessage('')
    setState('creating')

    try {
      let cardToken: string | undefined

      if (pgPublicKey) {
        // Encrypt card with PagSeguro
        cardToken = encryptCard()
      }

      await createSubscription(
        planId,
        cardToken,
        payerName.trim(),
        payerDocument.replace(/\D/g, ''),
        undefined, // deviceId removed (no longer needed without MP)
      )

      setState('success')
      router.push('/subscription/success')
    } catch (err: unknown) {
      console.error('[checkout] Full error:', err)
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Falha ao criar assinatura. Tente novamente.'
      setState('error')
      setErrorMessage(message)
    }
  }, [planId, plan, payerName, payerDocument, validate, router, pgPublicKey, encryptCard])

  // ----- Creating state -----
  if (state === 'creating') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <h2 className="mt-6 text-lg font-semibold text-foreground">Preparando assinatura...</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
          Aguarde enquanto configuramos sua assinatura.
        </p>
      </div>
    )
  }

  // ----- Success state -----
  if (state === 'success') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background bg-pattern">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
          <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">Assinatura criada!</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
          Redirecionando para o dashboard...
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
              onClick={() => setState('form')}
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

  // ----- Form state -----
  const formattedPlanPrice = plan ? formatBRL(plan.price) : ''

  return (
    <div className="flex-1 flex items-start justify-center bg-background bg-pattern px-4 py-12 min-h-screen">
      <div className="w-full max-w-md">
        {/* Page title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Finalizar assinatura</h1>
        </div>

        {/* Plan summary card */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          {plan && (
            <div className="text-center">
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
        </div>

        {/* Payer info form */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Dados do comprador
          </h3>

          {/* Name field */}
          <div className="mb-4">
            <label htmlFor="payerName" className="block text-sm font-medium text-foreground mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              id="payerName"
              type="text"
              value={payerName}
              onChange={(e) => {
                setPayerName(e.target.value)
                if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }))
              }}
              placeholder="Como no seu cartão"
              className={`w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                formErrors.name ? 'border-red-500' : 'border-border'
              }`}
              autoComplete="name"
            />
            {formErrors.name && (
              <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
            )}
          </div>

          {/* CPF field */}
          <div className="mb-4">
            <label htmlFor="payerDocument" className="block text-sm font-medium text-foreground mb-1">
              CPF <span className="text-red-500">*</span>
            </label>
            <input
              id="payerDocument"
              type="text"
              value={payerDocument}
              onChange={(e) => {
                setPayerDocument(formatCPF(e.target.value))
                if (formErrors.document) setFormErrors((prev) => ({ ...prev, document: undefined }))
              }}
              placeholder="000.000.000-00"
              maxLength={14}
              className={`w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                formErrors.document ? 'border-red-500' : 'border-border'
              }`}
              autoComplete="off"
              inputMode="numeric"
            />
            {formErrors.document && (
              <p className="mt-1 text-xs text-red-500">{formErrors.document}</p>
            )}
          </div>

          {/* Card form */}
          {pgPublicKey && plan && (
            <>
              <h3 className="text-sm font-semibold text-foreground mb-4 mt-6 pt-6 border-t border-border">
                Dados do cartão
              </h3>

              {/* Card number */}
              <div className="mb-4">
                <label htmlFor="cardNumber" className="block text-sm font-medium text-foreground mb-1">
                  Número do cartão <span className="text-red-500">*</span>
                </label>
                <input
                  id="cardNumber"
                  type="text"
                  value={cardNumber}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 16)
                    const formatted = raw.replace(/(.{4})/g, '$1 ').trim()
                    setCardNumber(formatted)
                    if (formErrors.card) setFormErrors((prev) => ({ ...prev, card: undefined }))
                  }}
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  className={`w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    formErrors.card ? 'border-red-500' : 'border-border'
                  }`}
                  autoComplete="cc-number"
                  inputMode="numeric"
                />
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label htmlFor="cardExpiry" className="block text-sm font-medium text-foreground mb-1">
                    Validade <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cardExpiry"
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => {
                      setCardExpiry(formatExpiry(e.target.value))
                      if (formErrors.card) setFormErrors((prev) => ({ ...prev, card: undefined }))
                    }}
                    placeholder="MM/AA"
                    maxLength={5}
                    className={`w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      formErrors.card ? 'border-red-500' : 'border-border'
                    }`}
                    autoComplete="cc-exp"
                  />
                </div>
                <div>
                  <label htmlFor="cardCvv" className="block text-sm font-medium text-foreground mb-1">
                    CVV <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cardCvv"
                    type="text"
                    value={cardCvv}
                    onChange={(e) => {
                      setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))
                      if (formErrors.card) setFormErrors((prev) => ({ ...prev, card: undefined }))
                    }}
                    placeholder="123"
                    maxLength={4}
                    className={`w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      formErrors.card ? 'border-red-500' : 'border-border'
                    }`}
                    autoComplete="cc-csc"
                    inputMode="numeric"
                  />
                  {formErrors.card && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.card}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {!pgPublicKey && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-400">
              Pagamento por cartão indisponível no momento.
            </div>
          )}

          {/* Subscribe button */}
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={planLoading || !pgReady}
            className="w-full mt-6 py-3 rounded-lg bg-primary text-background font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {planLoading
              ? 'Carregando...'
              : !pgReady
              ? 'Preparando...'
              : `Assinar ${formattedPlanPrice}${plan?.slug === 'monthly' ? '/mês' : '/ano'}`}
          </button>
        </div>

        {/* Security note */}
        <p className="mt-4 text-xs text-muted-foreground text-center leading-relaxed">
          Pagamento processado de forma segura pelo{' '}
          <span className="text-foreground">PagBank</span>.
          Os dados do seu cartão são criptografados antes do envio.
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
