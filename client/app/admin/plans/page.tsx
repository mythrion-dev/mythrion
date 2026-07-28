'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  adminFetchPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeletePlan,
  type CreatePlanPayload,
  type UpdatePlanPayload,
} from '@/lib/subscription-admin-api'
import type { Plan } from '@/lib/subscription-api'

/* ---------- helpers ---------- */
function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function parseBRLtoCents(value: string): number {
  // Accept "120,00" or "120.00" or "120"
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const float = parseFloat(normalized)
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
  mpPlanId: string
}

const emptyForm = (): PlanFormData => ({
  id: '',
  slug: '',
  name: '',
  description: '',
  price: '',
  mpPlanId: '',
})

function formFromPlan(plan: Plan): PlanFormData {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? '',
    price: formatCentsToBRLInput(plan.price),
    mpPlanId: plan.mpPlanId,
  }
}

/* ---------- page ---------- */
export default function AdminPlansPage() {
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
      setError(err instanceof Error ? err.message : 'Failed to load plans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  // ----- Copy mpPlanId -----
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

    // Validate
    if (editingId === 'new') {
      if (!form.id.trim()) { setFormError('ID é obrigatório'); return }
      if (!form.slug.trim()) { setFormError('Slug é obrigatório'); return }
    }
    if (!form.name.trim()) { setFormError('Nome é obrigatório'); return }
    if (!form.price.trim()) { setFormError('Preço é obrigatório'); return }
    if (!form.mpPlanId.trim()) { setFormError('ID do plano no MP é obrigatório'); return }

    const price = parseBRLtoCents(form.price)
    if (price <= 0) { setFormError('Preço deve ser maior que zero'); return }

    setSaving(true)
    try {
      if (editingId === 'new') {
        const created = await adminCreatePlan({
          id: form.id.trim(),
          slug: form.slug.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          price,
          mpPlanId: form.mpPlanId.trim(),
        })
        setPlans((prev) => [...prev, created].sort((a, b) => a.price - b.price))
      } else {
        const payload: UpdatePlanPayload = {}
        if (form.slug.trim()) payload.slug = form.slug.trim()
        if (form.name.trim()) payload.name = form.name.trim()
        if (form.description.trim()) payload.description = form.description.trim()
        payload.price = price
        if (form.mpPlanId.trim()) payload.mpPlanId = form.mpPlanId.trim()

        const updated = await adminUpdatePlan(editingId!, payload)
        setPlans((prev) =>
          prev.map((p) => (p.id === editingId ? updated : p)).sort((a, b) => a.price - b.price),
        )
      }
      cancelForm()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }, [editingId, form, cancelForm])

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
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleteLoading(false)
    }
  }, [deletingId])

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
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os planos de assinatura da plataforma.
          </p>
        </div>
        <button
          onClick={startCreate}
          disabled={editingId === 'new'}
          className="px-4 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Novo Plano
        </button>
      </div>

      {/* Inline create / edit form */}
      {editingId && (
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {editingId === 'new' ? 'Novo Plano' : 'Editar Plano'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editingId === 'new' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">ID *</label>
                  <input
                    type="text"
                    value={form.id}
                    onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                    placeholder="Ex: monthly, annual, premium..."
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Slug *</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="Ex: monthly, annual"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </>
            )}
            <div className={editingId !== 'new' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Mensal, Anual"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição opcional do plano..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Preço (R$) *</label>
              <input
                type="text"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="Ex: 120,00"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">ID do Plano (MP) *</label>
              <input
                type="text"
                value={form.mpPlanId}
                onChange={(e) => setForm((f) => ({ ...f, mpPlanId: e.target.value }))}
                placeholder="ID do preapproval_plan no Mercado Pago"
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
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={cancelForm}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Plans table */}
      {plans.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-border rounded-xl">
          <p className="text-muted-foreground text-sm">Nenhum plano cadastrado.</p>
          <button
            onClick={startCreate}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Criar primeiro plano
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">ID</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Slug</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">Nome</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Preço</th>
                <th className="text-left py-3 px-2 text-muted-foreground font-medium">MP Plan ID</th>
                <th className="text-right py-3 px-2 text-muted-foreground font-medium">Ações</th>
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
                      <span className="font-mono text-xs text-foreground">{truncateId(plan.mpPlanId)}</span>
                      <button
                        onClick={() => handleCopy(plan.mpPlanId)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Copiar MP Plan ID"
                      >
                        {copiedId === plan.mpPlanId ? (
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
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingId(plan.id)}
                        disabled={editingId !== null}
                        className="px-3 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Excluir
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
            <h3 className="text-lg font-semibold text-foreground mb-2">Excluir plano</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.
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
                {deleteLoading ? 'Excluindo...' : 'Excluir'}
              </button>
              <button
                onClick={() => { setDeletingId(null); setDeleteError(null) }}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
