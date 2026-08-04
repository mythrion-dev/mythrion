'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { cancelSubscription } from '@/lib/subscription-api'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

function formatPrice(cents: number): string {
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

export default function ManageSubscriptionPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { subscription, loading, refresh } = useSubscription()
  const router = useRouter()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  async function handleCancel() {
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
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
    )
  }

  const statusLabels: Record<string, { labelKey: string; color: string }> = {
    PENDING: { labelKey: 'billing:statusPending', color: 'text-amber-500 border-amber-500/20 bg-amber-500/10' },
    AUTHORIZED: { labelKey: 'billing:statusAuthorized', color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' },
    ACTIVE: { labelKey: 'billing:statusActive', color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' },
    GRACE: { labelKey: 'billing:statusGracePeriod', color: 'text-amber-500 border-amber-500/20 bg-amber-500/10' },
    EXPIRED: { labelKey: 'billing:statusExpired', color: 'text-red-500 border-red-500/20 bg-red-500/10' },
    CANCELLED: { labelKey: 'billing:statusCancelled', color: 'text-muted border-border bg-surface' },
  }

  const statusInfo = statusLabels[subscription.status] ?? {
    labelKey: '',
    color: 'text-muted border-border bg-surface',
  }

  const isActive = ['AUTHORIZED', 'ACTIVE', 'GRACE'].includes(subscription.status)
  const isCancellable = isActive && !subscription.cancelAtPeriodEnd
  const periodEnd = subscription.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : t('billing:endOfBillingPeriod')

  return (
    <div className="max-w-2xl mx-auto py-6">
      <h1 className="text-xl font-semibold text-foreground">{t('common:subscription')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('billing:subscriptionSubtitle')}
      </p>

      {/* Plan overview */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-base font-medium text-foreground">{subscription.plan.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatPrice(subscription.plan.price)}
              {subscription.plan.slug === 'annual' ? t('billing:periodYear') : t('billing:periodMonth')}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
            {statusInfo.labelKey ? t(statusInfo.labelKey) : subscription.status}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6 space-y-4">
        <h3 className="text-sm font-medium text-foreground">{t('common:details')}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t('common:status')}</p>
            <p className="mt-0.5 font-medium text-foreground capitalize">
              {subscription.status.toLowerCase()}
            </p>
          </div>
          {(subscription.currentPeriodStart || subscription.currentPeriodEnd) && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">{t('billing:currentPeriodStart')}</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {formatDate(subscription.currentPeriodStart)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('billing:currentPeriodEnd')}</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </>
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
                {formatDate(subscription.cancelledAt)}
              </p>
            </div>
          )}
          {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
            <div className="col-span-2">
              <p className="text-xs text-amber-500 font-medium">{t('billing:cancellationScheduled')}</p>
              <p className="mt-0.5 text-sm text-amber-600 dark:text-amber-400">
                {t('billing:expiryMessage', { date: formatDate(subscription.currentPeriodEnd) })}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">{t('billing:createdAt')}</p>
            <p className="mt-0.5 font-medium text-foreground">
              {formatDate(subscription.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6 space-y-3">
        <h3 className="text-sm font-medium text-foreground">{t('billing:actions')}</h3>

        {subscription.status === 'GRACE' && (
          <Link
            href="/subscription/manage"
            className="btn-ghost text-sm w-full justify-center"
          >
            {t('common:updatePaymentMethod')}
          </Link>
        )}

        {isCancellable && (
          <>
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="btn-ghost text-sm w-full justify-center text-red-500 hover:text-red-600 hover:bg-red-500/5"
              >
                {t('billing:cancelSubscription')}
              </button>
            ) : (
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
                    className="btn-ghost text-xs px-3 py-1.5"
                    disabled={cancelling}
                  >
                    {t('billing:keepSubscription')}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="btn-primary text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 border-red-600"
                    disabled={cancelling}
                  >
                    {cancelling ? t('billing:cancelling') : t('billing:confirmCancellation')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoices */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-medium text-foreground">{t('billing:recentInvoices')}</h3>
        {subscription.invoices.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('billing:noInvoices')}</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {subscription.invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {formatPrice(invoice.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(invoice.createdAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                    invoice.status === 'paid'
                      ? 'text-emerald-500 bg-emerald-500/10'
                      : invoice.status === 'pending'
                        ? 'text-amber-500 bg-amber-500/10'
                        : 'text-muted bg-surface'
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
