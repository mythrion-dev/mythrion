export interface CreateSubscriptionParams {
  planId: string
  planPrice: number
  planSlug: string
  planName: string
  payerEmail: string
  backUrl: string
  /** PagBank encrypted card string (from client-side PagSeguro SDK) — used in billing_info.encrypted */
  cardToken?: string
  /** Pre-defined PagBank card token (CARD_* or TOKE_* format) — used in payment_method.card.token.
   *  For sandbox, use the pre-defined tokens from PagBank test docs (e.g. CARD_8286F604-... for MasterCard 5555666677778884).
   *  When provided, takes precedence for payment_method; cardToken is still used for billing_info. */
  cardTokenId?: string
  /** Raw CVV — required by PagBank alongside the card data */
  securityCode?: string
  payerName?: string
  payerDocument?: string // CPF digits only
  externalReference?: string
  deviceId?: string
}

export interface CreateSubscriptionResult {
  id: string // gateway subscription ID (SUB_xxx)
  initPoint: string // redirect URL (empty for card flow)
  status: string // gateway native status (e.g. 'ACTIVE')
  customerId?: string // PagBank customer UUID (CUST_xxx)
}

export interface GatewaySubscription {
  id: string
  status: string
  nextPaymentDate?: string | null
  customerId?: string
}

export interface PaymentCharge {
  id: string
  status: string
  subscriptionId: string // links charge to subscription
  transactionAmount: number
  currencyId: string
  nextPaymentDate?: string | null
  dateApproved?: string | null
}

export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY'

export interface PaymentGateway {
  createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult>
  cancelSubscription(gatewaySubscriptionId: string): Promise<void>
  updatePaymentMethod(
    gatewaySubscriptionId: string,
    customerId: string,
    cardToken: string,
  ): Promise<void>
  getSubscription(gatewaySubscriptionId: string): Promise<GatewaySubscription>
  getPaymentCharge(chargeId: string): Promise<PaymentCharge>
  validateWebhook(rawBody: string, authenticityToken: string | undefined): boolean
}
