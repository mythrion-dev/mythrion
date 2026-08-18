import { api } from './api'
import type { Plan, PlanLimits } from './subscription-api'

export interface CreatePlanPayload {
  id: string
  slug: string
  name: string
  description?: string
  /** Price in cents (BRL) */
  price: number
  pgPlanId: string
  /** Usage caps: { maxCampaigns?, maxTemplates? }. null/absent = unlimited. */
  limits?: PlanLimits | null
}

export interface UpdatePlanPayload {
  slug?: string
  name?: string
  description?: string
  /** Price in cents (BRL) */
  price?: number
  pgPlanId?: string
  /** Usage caps: { maxCampaigns?, maxTemplates? }. null/{} clears caps. */
  limits?: PlanLimits | null
}

export async function adminFetchPlans(): Promise<Plan[]> {
  return api.get<Plan[]>('/admin/subscription-plans')
}

export async function adminCreatePlan(data: CreatePlanPayload): Promise<Plan> {
  return api.post<Plan>('/admin/subscription-plans', data)
}

export async function adminUpdatePlan(id: string, data: UpdatePlanPayload): Promise<Plan> {
  return api.put<Plan>(`/admin/subscription-plans/${encodeURIComponent(id)}`, data)
}

export async function adminDeletePlan(id: string): Promise<void> {
  await api.delete<void>(`/admin/subscription-plans/${encodeURIComponent(id)}`)
}
