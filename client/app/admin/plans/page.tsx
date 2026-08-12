'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  adminFetchPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeletePlan,
  type UpdatePlanPayload,
} from '@/lib/subscription-admin-api'
import type { Plan, PlanLimits } from '@/lib/subscription-api'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

/* ---------- helpers ---------- */
function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function parseBRLtoCents(value: string): number {
  // Accept "120,00" or "120.00" or "120"
  const normalized = value.replaceAll('./', '').replaceAll(',', '.')
  const float = Number.parseFloat(normalized)
  if (Number.isNaN(float) || float < 0) return 0
  return Math.round(float * 100)
}

function formatCentsToBRLInput(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function truncateId(id: string, max = 16): string {
  return id.length > max ? `${id.slice(0, max)}...` : id
}

/* ---------- inline form (create / edit) ---------- */
interface PlanFormData {
  id: string
  slug: string
  name: string
  description: string
  price: string // BRL string, e.g. "120,00"
  pgPlanId: string
  maxCampaigns: string // blank = unlimited
  maxTemplates: string // blank = unlimited
}

const emptyForm = (): PlanFormData => ({
  id: '',
  slug: '',
  name: '',
  description: '',
  price: '',
  pgPlanId: '',
  maxCampaigns: '',
  maxTemplates: '',
})

function formFromPlan(plan: Plan): PlanFormData {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? '',
    price: formatCentsToBRLInput(plan.price),
    pgPlanId: plan.pgPlanId,
    maxCampaigns:
      plan.limits?.maxCampaigns != null ? String(plan.limits.maxCampaigns) : '',
    maxTemplates:
      plan.limits?.maxTemplates != null ? String(plan.limits.maxTemplates) : '',
  }
}

/**
 * Build the usage caps payload from the form. null = unlimited (clears caps).
 */
function buildLimits(form: PlanFormData): PlanLimits | null {
  const mc = form.maxCampaigns.trim()
  const mt = form.maxTemplates.trim()
  if (!mc && !mt) return null
  const limits: PlanLimits = {}
  if (mc) limits.maxCampaigns = Number(mc)
  if (mt) limits.maxTemplates = Number(mt)
  return limits
}

function sortByPrice(a: Plan, b: Plan): number {
  return a.price - b.price
}

function validatePlanForm(
  form: PlanFormData,
  editingId: string | null,
  t: TFunction,
): string | null {
  if (editingId === 'new') {
    if (!form.id.trim()) return t('billing:idRequired')
    if (!form.slug.trim()) return t('billing:slugRequired')
  }
  if (!form.name.trim()) return t('billing:nameRequired')
  if (!form.price.trim()) return t('billing:priceRequired')
  if (!form.pgPlanId.trim()) return t('billing:pagbankPlanIdRequired')
  if (parseBRLtoCents(form.price) <= 0) return t('billing:priceMustBePositive')
  const mc = form.maxCampaigns.trim()
  const mt = form.maxTemplates.trim()
  if ((mc && !/^\d+$/.test(mc)) || (mt && !/^\d+$/.test(mt))) {
    return t('billing:limitsInvalid')
  }
  return null
}

function buildUpdatePayload(
  form: PlanFormData,
  price: number,
): UpdatePlanPayload {
  const payload: UpdatePlanPayload = {}
  if (form.slug.trim()) payload.slug = form.slug.trim()
  if (form.name.trim()) payload.name = form.name.trim()
  if (form.description.trim()) payload.description = form.description.trim()
  payload.price = price
  if (form.pgPlanId.trim()) payload.pgPlanId = form.pgPlanId.trim()
  payload.limits = buildLimits(form)
  return payload
}

function replacePlan(
  prev: Plan[],
  editingId: string | null,
  updated: Plan,
): Plan[] {
  return prev
    .map((p) => (p.id === editingId ? updated : p))
    .sort(sortByPrice)
}

/* ---------- page ---------- */
export default function AdminPlansPage() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null) // null = create mode, 'new' = create form
  const [form, setForm] = useState<PlanFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchPlans()
      setPlans(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('billing:failedLoadPlans'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  // ----- Copy pgPlanId -----
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(text)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // clipboard unavailable
    }
  }, [])

  // ----- Start creating -----
  const startCreate = useCallback(() => {
    setEditingId('new')
    setForm(emptyForm())
    setFormError(null)
  }, [])

  // ----- Start editing -----
  const startEdit = useCallback((plan: Plan) => {
    setEditingId(plan.id)
    setForm(formFromPlan(plan))
    setFormError(null)
  }, [])

  // ----- Cancel form -----
  const cancelForm = useCallback(() => {
    setEditingId(null)
    setFormError(null)
  }, [])

  // ----- Save (create or update) -----
  const handleSave = useCallback(async () => {
    setFormError(null)

    const price = parseBRLtoCents(form.price)
    const validationError = validatePlanForm(form, editingId, t)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    try {
      if (editingId === 'new') {
        const created = await adminCreatePlan({
          id: form.id.trim(),
          slug: form.slug.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price,
          pgPlanId: form.pgPlanId.trim(),
          limits: buildLimits(form),
        })
        setPlans((prev) => [...prev, created].sort(sortByPrice))
      } else {
        const updated = await adminUpdatePlan(
          editingId!,
          buildUpdatePayload(form, price),
        )
        setPlans((prev) => replacePlan(prev, editingId, updated))
      }
      cancelForm()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('billing:saveError'))
    } finally {
      setSaving(false)
    }
  }, [editingId, form, cancelForm, t])

  // ----- Delete -----
  const handleDelete = useCallback(async () => {
    if (!deletingId) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await adminDeletePlan(deletingId)
      setPlans((prev) => prev.filter((p) => p.id !== deletingId))
      setDeletingId(null)
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : t('billing:deleteError'))
    } finally {
      setDeleteLoading(false)
    }
  }, [deletingId, t])

  // ----- Loading state -----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  // ----- Error state -----
  if (error) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10 mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm mb-4">{error}</p>
        <button onClick={loadPlans} className="px-4 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:opacity-90 transition-opacity">
          {t('billing:tryAgain')}
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('billing:plans')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('billing:plansSubtitle')}
          </p>
        </div>
        <button
          onClick={startCreate}
          disabled={editingId === 'new'}
          className="px-4 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('billing:newPlan')}
        </button>
      </div>

      {/* Inline create / edit form */}
      {editingId && (
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {editingId === 'new' ? t('billing:newPlan') : t('billing:editPlan')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editingId === 'new' && (
              <>
                <div>
                  <div className="block text-sm font-medium text-foreground mb-1">{t('billing:idField')}</div>
                  <input
                    type="text"
                    value={form.id}
                    onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                    placeholder={t('billing:idPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <div className="block text-sm font-medium text-foreground mb-1">{t('billing:slugField')}</div>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder={t('billing:slugPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </>
            )}
            <div className={editingId !== 'new' ? 'md:col-span-2' : ''}>
              <div className="block text-sm font-medium text-foreground mb-1">{t('billing:nameLabel')}</div>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('billing:namePlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="md:col-span-2">
              <div className="block text-sm font-medium text-foreground mb-1">{t('common:description')}</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('billing:descriptionPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
            <div>
              <div className="block text-sm font-medium text-foreground mb-1">{t('billing:priceLabel')}</div>
              <input
                type="text"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder={t('billing:pricePlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <div className="block text-sm font-medium text-foreground mb-1">{t('billing:pagbankPlanIdField')}</div>
              <input
                type="text"
                value={form.pgPlanId}
                onChange={(e) => setForm((f) => ({ ...f, pgPlanId: e.target.value }))}
                placeholder={t('billing:pagbankPlanIdPlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="md:col-span-2 mt-2">
              <div className="block text-sm font-medium text-foreground mb-1">{t('billing:limitsSection')}</div>
              <p className="text-xs text-muted-foreground mb-3">{t('billing:limitsHint')}</p>
            </div>
            <div>
              <div className="block text-sm font-medium text-foreground mb-1">{t('billing:maxCampaignsLabel')}</div>
              <input
                type="text"
                inputMode="numeric"
                value={form.maxCampaigns}
                onChange={(e) => setForm((f) => ({ ...f, maxCampaigns: e.target.value }))}
                placeholder={t('billing:maxCampaignsPlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <div className="block text-sm font-medium text-foreground mb-1">{t('billing:maxTemplatesLabel')}</div>
              <input
                type="text"
                inputMode="numeric"
                value={form.maxTemplates}
                onChange={(e) => setForm((f) => ({ ...f, maxTemplates: e.target.value }))}
                placeholder={t('billing:maxTemplatesPlaceholder')}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {formError && (
            <p className="mt-3 text-sm text-red-500">{formError}</p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('billing:saving') : t('common:save')}
            </button>
            <button
              onClick={cancelForm}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {t('common:cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Plans table */}
      {plans.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-xl">
          <p className="text-muted-foreground text-sm">{t('billing:noPlansRegistered')}</p>
          <button
            onClick={startCreate}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {t('billing:createFirstPlan')}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">{t('billing:idColumn')}</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">{t('billing:slugColumn')}</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">{t('billing:nameColumn')}</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">{t('billing:priceColumn')}</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">{t('billing:pagbankPlanIdColumn')}</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">{t('billing:actions')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-border hover:bg-surface/50 transition-colors">
                  <td className="py-3 px-2 text-foreground font-mono text-xs">{plan.id}</td>
                  <td className="py-3 px-2 text-foreground">{plan.slug}</td>
                  <td className="py-3 px-2 text-foreground">{plan.name}</td>
                  <td className="py-3 px-2 text-foreground text-right">{formatBRL(plan.price)}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-foreground">{truncateId(plan.pgPlanId)}</span>
                      <button
                        onClick={() => handleCopy(plan.pgPlanId)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title={t('billing:copyPagbankPlanIdTitle')}
                      >
                        {copiedId === plan.pgPlanId ? (
                          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(plan)}
                        disabled={editingId !== null}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {t('common:edit')}
                      </button>
                      <button
                        onClick={() => setDeletingId(plan.id)}
                        disabled={editingId !== null}
                        className="px-3 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {t('common:delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('billing:deletePlanTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('billing:deletePlanConfirmMessage')}
            </p>

            {deleteError && (
              <p className="mb-4 text-sm text-red-500">{deleteError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? t('billing:deleting') : t('common:delete')}
              </button>
              <button
                onClick={() => { setDeletingId(null); setDeleteError(null) }}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {t('common:cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
