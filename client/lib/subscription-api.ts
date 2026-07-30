import { api } from './api'

export interface Plan {
  id: string
  slug: string
  name: string
  description: string | null
  price: number
  pgPlanId: string
}

export interface Invoice {
  id: string
  amount: number
  currency: string
  status: string
  paidAt: string | null
  dueDate: string | null
  createdAt: string
}

export interface MySubscription {
  id: string
  plan: {
    slug: string
    name: string
    price: number
  }
  status: string
  pgSubscriptionId: string | null
  graceEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelledAt: string | null
  cancelAtPeriodEnd: boolean
  createdAt: string
  invoices: Invoice[]
}

export interface CreateSubscriptionResponse {
  initPoint: string
  subscriptionId: string
}

export async function fetchPlans(): Promise<Plan[]> {
  return api.get<Plan[]>('/subscriptions/plans')
}

export async function createSubscription(
  planId: string,
  cardToken?: string,
  payerName?: string,
  payerDocument?: string,
  deviceId?: string,
): Promise<CreateSubscriptionResponse> {
  return api.post<CreateSubscriptionResponse>('/subscriptions', {
    planId,
    ...(cardToken ? { cardToken } : {}),
    ...(payerName ? { payerName } : {}),
    ...(payerDocument ? { payerDocument } : {}),
    ...(deviceId ? { deviceId } : {}),
  })
}

export async function fetchMySubscription(): Promise<MySubscription | null> {
  return api.get<MySubscription | null>('/subscriptions/mine')
}

export async function cancelSubscription(): Promise<void> {
  await api.post<void>('/subscriptions/cancel')
}

export async function updatePaymentMethod(
  cardToken: string,
  payerName?: string,
  payerDocument?: string,
): Promise<void> {
  await api.post<void>('/subscriptions/update-payment-method', {
    cardToken,
    ...(payerName ? { payerName } : {}),
    ...(payerDocument ? { payerDocument } : {}),
  })
}
