'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import {
  cancelSubscription,
  updatePaymentMethod,
  type MySubscription,
} from '@/lib/subscription-api'
import { PageHeader } from '@/components/shared/PageHeader'

/* ─── helpers ─────────────────────────────────────────────────── */

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_CONFIG: Record<string, { labelKey: string; color: string }> = {
  PENDING: { labelKey: 'billing:statusPending', color: 'text-amber-500 border-amber-500/20 bg-amber-500/10' },
  AUTHORIZED: { labelKey: 'billing:statusAuthorized', color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' },
  ACTIVE: { labelKey: 'billing:statusActive', color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' },
  GRACE: { labelKey: 'billing:statusGracePeriod', color: 'text-amber-500 border-amber-500/20 bg-amber-500/10' },
  EXPIRED: { labelKey: 'billing:statusExpired', color: 'text-red-500 border-red-500/20 bg-red-500/10' },
  CANCELLED: { labelKey: 'billing:statusCancelled', color: 'text-muted border-border bg-surface' },
}

/* ─── status badge ─────────────────────────────────────────────── */

function StatusBadge({ status }: { readonly status: string }) {
  const { t } = useTranslation()
  const cfg = STATUS_CONFIG[status] ?? {
    labelKey: '',
    color: 'text-muted border-border bg-surface',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.labelKey ? t(cfg.labelKey) : status}
    </span>
  )
}

/* ─── plan overview + details ──────────────────────────────────── */

function SubscriptionOverview({
  subscription,
  subscriberLabel,
}: {
  readonly subscription: MySubscription
  readonly subscriberLabel: string
}) {
  const { t } = useTranslation()
  const statusLabel = STATUS_CONFIG[subscription.status]?.labelKey
    ? t(STATUS_CONFIG[subscription.status]!.labelKey)
    : subscription.status.toLowerCase()

  return (
    <>
      {/* Plan overview */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{subscription.plan.name}</h2>
              <StatusBadge status={subscription.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatBRL(subscription.plan.price)}
              {subscription.plan.slug === 'annual' ? t('billing:periodYear') : t('billing:periodMonth')}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t('common:details')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t('common:status')}</p>
            <p className="mt-0.5 font-medium text-foreground capitalize">
              {statusLabel}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('billing:subscriber')}</p>
            <p className="mt-0.5 font-medium text-foreground truncate">
              {subscriberLabel}
            </p>
          </div>
          {subscription.currentPeriodStart && (
            <div>
              <p className="text-xs text-muted-foreground">{t('billing:currentPeriodStart')}</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatDate(subscription.currentPeriodStart)}
              </p>
            </div>
          )}
          {subscription.currentPeriodEnd && (
            <div>
              <p className="text-xs text-muted-foreground">{t('billing:currentPeriodEnd')}</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          )}
          {subscription.graceEndsAt && subscription.status === 'GRACE' && (
            <div>
              <p className="text-xs text-muted-foreground">{t('billing:gracePeriodEnds')}</p>
              <p className="mt-0.5 font-medium text-amber-600 dark:text-amber-400">
                {formatDate(subscription.graceEndsAt)}
              </p>
            </div>
          )}
          {subscription.cancelledAt && (
            <div>
              <p className="text-xs text-muted-foreground">{t('billing:cancelledAt')}</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatDateTime(subscription.cancelledAt)}
              </p>
            </div>
          )}
          {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
            <div className="sm:col-span-2">
              <p className="text-xs text-amber-500 font-medium">{t('billing:cancellationScheduled')}</p>
              <p className="mt-0.5 text-sm text-amber-600 dark:text-amber-400">
                {t('billing:expiryMessage', { date: formatDate(subscription.currentPeriodEnd) })}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">{t('billing:createdAt')}</p>
            <p className="mt-0.5 font-medium text-foreground">
              {formatDateTime(subscription.createdAt)}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── PagSeguro encryption script loader ──────────────────────── */

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
      console.error('[dashboard] Failed to load PagSeguro encryption SDK')
      setReady(true) // Proceed without — error will be caught at submit time
    }
    document.head.appendChild(script)

    return () => {
      // No cleanup needed — script stays in DOM
    }
  }, [])

  return ready
}

/* ─── main page ────────────────────────────────────────────────── */

export default function DashboardSubscriptionPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { subscription, loading, refresh } = useSubscription()
  // Payment method state
  const [payerName, setPayerName] = useState('')
  const [payerDocument, setPayerDocument] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [showCardForm, setShowCardForm] = useState(false)
  const [updatingCard, setUpdatingCard] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [formErrors, setFormErrors] = useState<{ name?: string; document?: string; card?: string }>({})
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const pgReady = usePagBankEncryption()
  const pgPublicKey = process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY

  // Cancel state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // CPF mask
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

  // ─── toast auto-dismiss ───────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  // ─── form validation ───────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errors: { name?: string; document?: string; card?: string } = {}

    if (!payerName.trim() || payerName.trim().length < 3) {
      errors.name = t('billing:cardHolderNameRequired')
    }

    const digits = payerDocument.replace(/\D/g, '')
    if (digits.length !== 11) {
      errors.document = t('billing:cpfInvalid')
    }

    if (pgPublicKey) {
      if (cardNumber.replace(/\D/g, '').length < 13) {
        errors.card = t('billing:cardNumberInvalid')
      }
      if (cardExpiry.replace(/\D/g, '').length < 4) {
        errors.card = t('billing:cardExpiryInvalid')
      }
      if (cardCvv.replace(/\D/g, '').length < 3) {
        errors.card = t('billing:cardCvvInvalid')
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [payerName, payerDocument, pgPublicKey, cardNumber, cardExpiry, cardCvv, t])

  // ─── handle card update ───────────────────────────────────────
  const handleUpdateCard = useCallback(async () => {
    if (!subscription?.pgSubscriptionId) return
    if (!validate()) return

    setUpdatingCard(true)
    setUpdateError('')
    setToast(null)

    try {
      let cardToken: string

      if (pgPublicKey) {
        // Encrypt card with PagSeguro
        const pg = (window as any).PagSeguro
        if (!pg?.encryptCard) {
          throw new Error(t('billing:sdkNotLoaded'))
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
          throw new Error(t('billing:encryptionError', { message: msgs || t('billing:cardDataInvalid') }))
        }

        cardToken = result.encryptedCard
      } else {
        // No encryption configured — should not reach this in production
        cardToken = `unencrypted_${cardNumber.replace(/\s/g, '')}_${cardExpiry.replace('/', '')}_${cardCvv}`
      }

      await updatePaymentMethod(
        cardToken,
        payerName.trim(),
        payerDocument.replace(/\D/g, ''),
      )

      setToast({ type: 'success', message: t('billing:cardUpdatedSuccess') })
      setShowCardForm(false)
      setFormErrors({})
      setPayerName('')
      setPayerDocument('')
      setCardNumber('')
      setCardExpiry('')
      setCardCvv('')
    } catch (err: unknown) {
      console.error('[subscription] Update card error:', err)
      const message =
        err instanceof Error
          ? err.message
          : t('billing:cardUpdateFailed')
      setUpdateError(message)
      setToast({ type: 'error', message })
    } finally {
      setUpdatingCard(false)
    }
  }, [subscription, payerName, payerDocument, cardNumber, cardExpiry, cardCvv, pgPublicKey, validate, t])

  // ─── handle cancel ────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    setCancelling(true)
    setCancelError('')
    try {
      await cancelSubscription()
      await refresh()
      setShowCancelConfirm(false)
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : t('billing:subscriptionCancelFailed'),
      )
    } finally {
      setCancelling(false)
    }
  }, [refresh, t])

  // ─── loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  // ─── no subscription state ────────────────────────────────────
  if (!subscription) {
    return (
      <div>
        <PageHeader
          title={t('common:subscription')}
          subtitle={t('billing:subscriptionSubtitle')}
        />
        <div className="mt-8 max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/20 mb-4">
            <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t('billing:noSubscription')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('billing:noActiveSubscription')}
          </p>
          <Link href="/pricing" className="btn-primary mt-6 inline-flex px-5 py-2.5 text-sm">
            {t('common:viewPlans')}
          </Link>
        </div>
      </div>
    )
  }

  const isUpdatable = ['AUTHORIZED', 'ACTIVE', 'GRACE'].includes(subscription.status)
  const isCancellable = isUpdatable && !subscription.cancelAtPeriodEnd
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : t('billing:endOfBillingPeriod')

  const pgStateLabel = !pgReady ? t('billing:preparing') : t('billing:updateCard')
  const updateCardLabel = updatingCard ? t('billing:updating') : pgStateLabel

  return (
    <div>
      <PageHeader
        title={t('common:subscription')}
        subtitle={t('billing:subscriptionSubtitle')}
      />

      {/* ─── Toast notification ───────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-slide-up glass-panel flex items-start gap-3 px-4 py-3 shadow-xl ${
            toast.type === 'success' ? 'border-success/40' : 'border-danger/40'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="w-5 h-5 text-success shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.02A2 2 0 003.82 21h16.36a2 2 0 001.79-2.07l-8.18-14.02a2 2 0 00-3.57 0z" />
            </svg>
          )}
          <p className="text-sm font-medium text-foreground break-words leading-snug">
            {toast.message}
          </p>
          <button
            onClick={() => setToast(null)}
            aria-label={t('billing:closeNotification')}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ─── Plan overview + details ──────────────────────────── */}
      <SubscriptionOverview
        subscription={subscription}
        subscriberLabel={user?.displayName ?? user?.email ?? '—'}
      />

      {/* ─── Actions ──────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t('billing:actions')}</h3>

        {/* Update payment method */}
        {isUpdatable && !showCardForm && (
          <button
            onClick={() => setShowCardForm(true)}
            className="w-full py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-background/40 transition-colors"
          >
            {t('billing:changeCreditCard')}
          </button>
        )}

        {isUpdatable && showCardForm && (
          <div className="rounded-lg border border-border bg-background p-4">
            <h4 className="text-sm font-medium text-foreground mb-3">
              {t('billing:newCard')}
            </h4>

            {/* Payer name */}
            <div className="mb-3">
              <label htmlFor="cardPayerName" className="block text-sm font-medium text-foreground mb-1">
                {t('billing:cardHolderNameLabel')}
              </label>
              <input
                id="cardPayerName"
                type="text"
                value={payerName}
                onChange={(e) => {
                  setPayerName(e.target.value)
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }))
                }}
                placeholder={t('billing:cardHolderNamePlaceholder')}
                className={`w-full px-3 py-2 rounded-lg bg-background border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  formErrors.name ? 'border-red-500' : 'border-border'
                }`}
                autoComplete="name"
              />
              {formErrors.name && (
                <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>
              )}
            </div>

            {/* CPF */}
            <div className="mb-3">
              <label htmlFor="cardDocument" className="block text-sm font-medium text-foreground mb-1">
                {t('billing:cpfLabel')}
              </label>
              <input
                id="cardDocument"
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

            {/* Card number */}
            <div className="mb-3">
              <label htmlFor="cardNumber" className="block text-sm font-medium text-foreground mb-1">
                {t('billing:cardNumberLabel')}
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
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="cardExpiry" className="block text-sm font-medium text-foreground mb-1">
                  {t('billing:cardExpiryLabel')}
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
                  {t('billing:cardCvvLabel')}
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

            {updateError && (
              <p className="mb-3 text-xs text-red-500">{updateError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCardForm(false)
                  setUpdateError('')
                  setToast(null)
                  setFormErrors({})
                }}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={updatingCard}
              >
                {t('common:cancel')}
              </button>
              <button
                onClick={handleUpdateCard}
                disabled={updatingCard || !pgReady}
                className="flex-1 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateCardLabel}
              </button>
            </div>
          </div>
        )}

        {/* Cancel subscription */}
        {isCancellable && !showCancelConfirm && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="w-full py-2.5 rounded-lg border border-red-500/20 text-sm font-medium text-red-500 hover:bg-red-500/5 transition-colors"
          >
            {t('billing:cancelSubscription')}
          </button>
        )}

        {isCancellable && showCancelConfirm && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('billing:cancelConfirmMessage', { periodEnd })}
            </p>
            {cancelError && (
              <p className="mt-2 text-xs text-red-500">{cancelError}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  setCancelError('')
                }}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={cancelling}
              >
                {t('billing:keepSubscription')}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2 rounded-lg bg-red-600 text-background text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={cancelling}
              >
                {cancelling ? t('billing:cancelling') : t('billing:confirmCancellation')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Invoices ──────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t('billing:recentInvoices')}</h3>
        {subscription.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('billing:noInvoices')}</p>
        ) : (
          <div className="divide-y divide-border">
            {subscription.invoices.map((invoice) => {
              const pendingStatusClass = invoice.status === 'pending' ? 'text-amber-500 bg-amber-500/10' : 'text-muted bg-surface'
              const invoiceStatusClass = invoice.status === 'paid' ? 'text-emerald-500 bg-emerald-500/10' : pendingStatusClass
              const pendingStatusLabel = invoice.status === 'pending' ? t('common:pending') : invoice.status
              const invoiceStatusLabel = invoice.status === 'paid' ? t('billing:invoicePaid') : pendingStatusLabel
              return (
                <div key={invoice.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">
                      {formatBRL(invoice.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.createdAt)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${invoiceStatusClass}`}>
                    {invoiceStatusLabel}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
