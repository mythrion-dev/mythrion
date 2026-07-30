'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import {
  cancelSubscription,
  updatePaymentMethod,
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'text-amber-500 border-amber-500/20 bg-amber-500/10' },
  AUTHORIZED: { label: 'Autorizado', color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' },
  ACTIVE: { label: 'Ativo', color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' },
  GRACE: { label: 'Período de carência', color: 'text-amber-500 border-amber-500/20 bg-amber-500/10' },
  EXPIRED: { label: 'Expirado', color: 'text-red-500 border-red-500/20 bg-red-500/10' },
  CANCELLED: { label: 'Cancelado', color: 'text-muted border-border bg-surface' },
}

/* ─── status badge ─────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: 'text-muted border-border bg-surface',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

/* ─── main page ────────────────────────────────────────────────── */

export default function DashboardSubscriptionPage() {
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
  const [updateSuccess, setUpdateSuccess] = useState(false)

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

  // ─── handle card update ───────────────────────────────────────
  const handleUpdateCard = useCallback(async () => {
    if (!subscription?.pgSubscriptionId) return

    setUpdatingCard(true)
    setUpdateError('')
    setUpdateSuccess(false)

    try {
      // In PagBank flow, we send raw card data — the backend encrypts it server-side
      // or we use a PagBank encrypted card string from client-side JS
      // For now, send cardToken as a simulated encrypted payload
      const cardToken = `enc_card_${cardNumber.replace(/\s/g, '')}_${cardExpiry.replace('/', '')}_${cardCvv}`

      await updatePaymentMethod(
        cardToken,
        payerName.trim(),
        payerDocument.replace(/\D/g, ''),
      )

      setUpdateSuccess(true)
      setShowCardForm(false)
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
          : 'Falha ao atualizar cartão. Tente novamente.'
      setUpdateError(message)
    } finally {
      setUpdatingCard(false)
    }
  }, [subscription, payerName, payerDocument, cardNumber, cardExpiry, cardCvv])

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
        err instanceof Error ? err.message : 'Falha ao cancelar assinatura.',
      )
    } finally {
      setCancelling(false)
    }
  }, [refresh])

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
          title="Assinatura"
          subtitle="Gerencie sua assinatura Mythrion Premium."
        />
        <div className="mt-8 max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/20 mb-4">
            <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Nenhuma assinatura encontrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Você ainda não possui uma assinatura ativa.
          </p>
          <Link href="/pricing" className="btn-primary mt-6 inline-flex px-5 py-2.5 text-sm">
            Ver planos
          </Link>
        </div>
      </div>
    )
  }

  const isActive = ['AUTHORIZED', 'ACTIVE', 'GRACE'].includes(subscription.status)
  const isUpdatable = ['AUTHORIZED', 'ACTIVE', 'GRACE'].includes(subscription.status)
  const isCancellable = isUpdatable && !subscription.cancelAtPeriodEnd
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'ao final do período de faturamento atual'

  return (
    <div>
      <PageHeader
        title="Assinatura"
        subtitle="Gerencie sua assinatura Mythrion Premium."
      />

      {/* ─── Plan overview ─────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{subscription.plan.name}</h2>
              <StatusBadge status={subscription.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatBRL(subscription.plan.price)}
              {subscription.plan.slug === 'annual' ? '/ano' : '/mês'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Details ──────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Detalhes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-0.5 font-medium text-foreground capitalize">
              {STATUS_CONFIG[subscription.status]?.label ?? subscription.status.toLowerCase()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Assinante</p>
            <p className="mt-0.5 font-medium text-foreground truncate">
              {user?.displayName ?? user?.email ?? '—'}
            </p>
          </div>
          {subscription.currentPeriodStart && (
            <div>
              <p className="text-xs text-muted-foreground">Início do período</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatDate(subscription.currentPeriodStart)}
              </p>
            </div>
          )}
          {subscription.currentPeriodEnd && (
            <div>
              <p className="text-xs text-muted-foreground">Fim do período</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          )}
          {subscription.graceEndsAt && subscription.status === 'GRACE' && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Carência termina em</p>
                <p className="mt-0.5 font-medium text-amber-600 dark:text-amber-400">
                  {formatDate(subscription.graceEndsAt)}
                </p>
              </div>
            </>
          )}
          {subscription.cancelledAt && (
            <div>
              <p className="text-xs text-muted-foreground">Cancelada em</p>
              <p className="mt-0.5 font-medium text-foreground">
                {formatDateTime(subscription.cancelledAt)}
              </p>
            </div>
          )}
          {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
            <div className="sm:col-span-2">
              <p className="text-xs text-amber-500 font-medium">Cancelamento agendado</p>
              <p className="mt-0.5 text-sm text-amber-600 dark:text-amber-400">
                Sua assinatura expirará em {formatDate(subscription.currentPeriodEnd)}.
                Você mantém acesso até esta data.
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Criada em</p>
            <p className="mt-0.5 font-medium text-foreground">
              {formatDateTime(subscription.createdAt)}
            </p>
          </div>
          {subscription.pgSubscriptionId && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">ID PagBank</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
                {subscription.pgSubscriptionId}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Actions ──────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Ações</h3>

        {/* Update payment method */}
        {isUpdatable && !showCardForm && (
          <button
            onClick={() => setShowCardForm(true)}
            className="w-full py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-background/40 transition-colors"
          >
            Alterar cartão de crédito
          </button>
        )}

        {isUpdatable && showCardForm && (
          <div className="rounded-lg border border-border bg-background p-4">
            <h4 className="text-sm font-medium text-foreground mb-3">
              Novo cartão
            </h4>

            {/* Payer name */}
            <div className="mb-3">
              <label htmlFor="cardPayerName" className="block text-sm font-medium text-foreground mb-1">
                Nome no cartão <span className="text-red-500">*</span>
              </label>
              <input
                id="cardPayerName"
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Como no seu cartão"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoComplete="name"
              />
            </div>

            {/* CPF */}
            <div className="mb-3">
              <label htmlFor="cardDocument" className="block text-sm font-medium text-foreground mb-1">
                CPF <span className="text-red-500">*</span>
              </label>
              <input
                id="cardDocument"
                type="text"
                value={payerDocument}
                onChange={(e) => setPayerDocument(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoComplete="off"
                inputMode="numeric"
              />
            </div>

            {/* Card number */}
            <div className="mb-3">
              <label htmlFor="cardNumber" className="block text-sm font-medium text-foreground mb-1">
                Número do cartão <span className="text-red-500">*</span>
              </label>
              <input
                id="cardNumber"
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                placeholder="0000 0000 0000 0000"
                maxLength={16}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoComplete="cc-number"
                inputMode="numeric"
              />
            </div>

            {/* Expiry + CVV */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="cardExpiry" className="block text-sm font-medium text-foreground mb-1">
                  Validade <span className="text-red-500">*</span>
                </label>
                <input
                  id="cardExpiry"
                  type="text"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/AA"
                  maxLength={5}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  maxLength={4}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoComplete="cc-csc"
                  inputMode="numeric"
                />
              </div>
            </div>

            {updateError && (
              <p className="mb-3 text-xs text-red-500">{updateError}</p>
            )}

            {updateSuccess && (
              <p className="mb-3 text-xs text-emerald-500">Cartão atualizado com sucesso!</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCardForm(false)
                  setUpdateError('')
                  setUpdateSuccess(false)
                }}
                className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={updatingCard}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateCard}
                disabled={updatingCard}
                className="flex-1 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingCard ? 'Atualizando...' : 'Atualizar cartão'}
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
            Cancelar assinatura
          </button>
        )}

        {isCancellable && showCancelConfirm && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              Tem certeza que deseja cancelar sua assinatura? Seu acesso ao Mythrion Premium
              permanecerá ativo até {periodEnd}, quando a assinatura expirará.
              Nenhuma nova cobrança será feita.
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
                Manter assinatura
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 py-2 rounded-lg bg-red-600 text-background text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={cancelling}
              >
                {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Invoices ──────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-border bg-surface p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Faturas recentes</h3>
        {subscription.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
        ) : (
          <div className="divide-y divide-border">
            {subscription.invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {formatBRL(invoice.amount)}
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
                  {invoice.status === 'paid' ? 'Pago' : invoice.status === 'pending' ? 'Pendente' : invoice.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
