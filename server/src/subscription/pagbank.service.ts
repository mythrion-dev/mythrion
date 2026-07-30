import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common'
import { createHash, timingSafeEqual } from 'crypto'
import type {
  PaymentGateway,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  GatewaySubscription,
  PaymentCharge,
} from './payment-gateway.interface.js'

@Injectable()
export class PagBankService implements PaymentGateway {
  private readonly logger = new Logger(PagBankService.name)
  private readonly apiBase: string
  private readonly token: string
  private readonly webhookSecret: string

  constructor() {
    this.token = process.env.PAGBANK_TOKEN ?? ''
    this.apiBase =
      process.env.PAGBANK_API_URL ?? 'https://sandbox.api.assinaturas.pagseguro.com'
    this.webhookSecret = process.env.PAGBANK_WEBHOOK_SECRET ?? ''

    if (!this.token) {
      this.logger.warn(
        'PAGBANK_TOKEN is not set — PagBank integration will fail at runtime',
      )
    }
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
  }

  async createSubscription(
    params: CreateSubscriptionParams,
  ): Promise<CreateSubscriptionResult> {
    try {
      // Build the subscription request body.
      //
      // Two distinct flows exist depending on how the card is provided:
      //
      // A) cardTokenId (CARD_UUID pre-defined sandbox token):
      //    Send billing_info.card.token = CARD_UUID.
      //    DO NOT send payment_method[0].card — PagBank errors when both are sent:
      //      "The 'payment_method.card' value should not be entered when the
      //       billing_info_card_token is sent."
      //
      // B) cardToken (encrypted card string from PagSeguro JS SDK):
      //    Send billing_info.card.encrypted = <encrypted string>.
      //    Send payment_method[0].card.security_code = <CVV>.
      //
      // Sandbox pre-defined tokens (CARD_UUIDs):
      //   https://developer.pagbank.com.br/reference/testar-sua-integracao-pagamentos-recorrentes

      const body: Record<string, any> = {
        reference_id: params.externalReference,
        plan: { id: params.planId },
        amount: { value: params.planPrice, currency: 'BRL' },
        customer: this.buildCustomer(params),
        payment_method: [{
          type: 'CREDIT_CARD',
        }],
      }

      // Build billing_info card reference — used by PagBank for both the initial
      // charge and subsequent recurring payments.
      const billingCard: Record<string, any> = {}
      if (params.cardTokenId) {
        // Flow A: pre-defined sandbox card token (CARD_UUID) — set as card.token
        // in billing_info. Omit payment_method.card entirely.
        billingCard.token = params.cardTokenId
      } else if (params.cardToken) {
        // Flow B: encrypted card string from PagSeguro JS SDK — use as
        // card.encrypted in billing_info. Include security_code in
        // payment_method[0].card.
        billingCard.encrypted = params.cardToken
      }

      if (Object.keys(billingCard).length > 0) {
        body.customer.billing_info = [
          {
            type: 'CREDIT_CARD',
            card: billingCard,
          },
        ]
      }

      // Add installments to payment_method ONLY for the encrypted flow.
      // PagBank subscriptions API does not document this field, but it
      // may be forwarded to the acquirer for the initial charge.
      if (params.installments && !params.cardTokenId) {
        body.payment_method[0].installments = params.installments
      }

      // Add security_code to payment_method.card ONLY for the encrypted flow.
      // When cardTokenId is set, payment_method.card must be empty/omitted.
      if (!params.cardTokenId && params.securityCode) {
        body.payment_method[0].card = {
          security_code: Number(params.securityCode),
        }
      }

      const jsonBody = JSON.stringify(body)
      this.logger.log(
        `Creating PagBank subscription with payload: ${jsonBody}`,
      )

      const response = await fetch(`${this.apiBase}/subscriptions`, {
        method: 'POST',
        headers: this.headers,
        body: jsonBody,
      })

      const data = await response.json()

      if (!response.ok) {
        const pgError = JSON.stringify(data)
        this.logger.error(
          `PagBank API error creating subscription (${response.status}): ${pgError}`,
        )
        throw new UnprocessableEntityException(`PagBank error: ${pgError}`)
      }

      const result = data as any
      this.logger.log(
        `PagBank subscription created - id: ${result.id}, status: ${result.status}` +
          (result.customer?.id ? `, customerId: ${result.customer.id}` : ''),
      )

      return {
        id: result.id,
        initPoint: '', // PagBank subscriptions have no redirect URL
        status: result.status,
        customerId: result.customer?.id,
      }
    } catch (err: any) {
      if (err instanceof UnprocessableEntityException) throw err

      const pgError = err?.message || JSON.stringify(err)
      this.logger.error(`Failed to create PagBank subscription: ${pgError}`)
      throw new UnprocessableEntityException(`PagBank error: ${pgError}`)
    }
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.apiBase}/subscriptions/${gatewaySubscriptionId}/cancel`,
        { method: 'PUT', headers: this.headers },
      )

      if (!response.ok && response.status !== 404 && response.status !== 409) {
        const errorData = await response.json().catch(() => ({}))
        const pgError = JSON.stringify(errorData)
        this.logger.error(
          `PagBank API error cancelling subscription ${gatewaySubscriptionId} (${response.status}): ${pgError}`,
        )
        throw new UnprocessableEntityException(
          `Failed to cancel subscription: ${pgError}`,
        )
      }

      // 404 means already cancelled — treat as success
      // 409 means conflicting state — treat as success if already cancelled
      this.logger.log(
        `Cancelled PagBank subscription ${gatewaySubscriptionId} (status: ${response.status})`,
      )
    } catch (err: any) {
      if (err instanceof UnprocessableEntityException) throw err

      const pgError = err?.message || JSON.stringify(err)
      this.logger.error(
        `Failed to cancel PagBank subscription ${gatewaySubscriptionId}: ${pgError}`,
      )
      throw new UnprocessableEntityException('Failed to cancel subscription')
    }
  }

  async updatePaymentMethod(
    _gatewaySubscriptionId: string,
    customerId: string,
    cardToken: string,
  ): Promise<void> {
    try {
      // PagBank requires RAW_BODY wrapping for PUT /customers/{customer_id}/billing_info
      const body = {
        RAW_BODY: JSON.stringify({
          billing_info: [
            {
              type: 'CREDIT_CARD',
              card: { encrypted: cardToken },
            },
          ],
        }),
      }

      const response = await fetch(
        `${this.apiBase}/customers/${customerId}/billing_info`,
        {
          method: 'PUT',
          headers: this.headers,
          body: JSON.stringify(body),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const pgError = JSON.stringify(errorData)
        this.logger.error(
          `PagBank API error updating payment method for customer ${customerId} (${response.status}): ${pgError}`,
        )
        throw new UnprocessableEntityException(
          `Failed to update payment method: ${pgError}`,
        )
      }

      this.logger.log(
        `Updated payment method for PagBank customer ${customerId}`,
      )
    } catch (err: any) {
      if (err instanceof UnprocessableEntityException) throw err

      const pgError = err?.message || JSON.stringify(err)
      this.logger.error(
        `Failed to update PagBank payment method: ${pgError}`,
      )
      throw new UnprocessableEntityException(
        `Failed to update payment method: ${pgError}`,
      )
    }
  }

  async getSubscription(
    gatewaySubscriptionId: string,
  ): Promise<GatewaySubscription> {
    try {
      const response = await fetch(
        `${this.apiBase}/subscriptions/${gatewaySubscriptionId}`,
        { headers: this.headers },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        this.logger.error(
          `Failed to fetch PagBank subscription ${gatewaySubscriptionId} (${response.status}): ${JSON.stringify(errorData)}`,
        )
        throw new UnprocessableEntityException('Failed to fetch subscription')
      }

      const data = (await response.json()) as any

      return {
        id: data.id,
        status: data.status,
        nextPaymentDate: data.next_billing_date ?? null,
        customerId: data.customer?.id,
      }
    } catch (err: any) {
      if (err instanceof UnprocessableEntityException) throw err

      const pgError = err?.message || JSON.stringify(err)
      this.logger.error(
        `Failed to fetch PagBank subscription ${gatewaySubscriptionId}: ${pgError}`,
      )
      throw new UnprocessableEntityException('Failed to fetch subscription')
    }
  }

  async getPaymentCharge(chargeId: string): Promise<PaymentCharge> {
    try {
      const response = await fetch(
        `${this.apiBase}/payments/${chargeId}`,
        { headers: this.headers },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        this.logger.error(
          `Failed to fetch PagBank payment ${chargeId} (${response.status}): ${JSON.stringify(errorData)}`,
        )
        throw new Error(`Failed to fetch payment charge: ${response.status}`)
      }

      const data = (await response.json()) as any

      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `PagBank charge response for ${chargeId}: ${JSON.stringify(data)}`,
        )
      }

      return {
        id: data.id,
        status: data.status,
        subscriptionId: data.subscription_id,
        transactionAmount: data.amount?.value ?? 0,
        currencyId: data.amount?.currency ?? 'BRL',
        nextPaymentDate: data.next_payment_date ?? null,
        dateApproved: data.payment_date ?? null,
        installments: data.installments ?? data.installment_count ?? undefined,
      }
    } catch (err: any) {
      if (err instanceof Error) throw err

      const pgError = err?.message || JSON.stringify(err)
      this.logger.error(
        `Failed to fetch PagBank payment ${chargeId}: ${pgError}`,
      )
      throw new Error(`Failed to fetch payment charge: ${pgError}`)
    }
  }

  /**
   * Validate an incoming PagBank webhook using SHA-256.
   *
   * PagBank sends the signature in the `x-authenticity-token` header:
   *   SHA-256("{webhookSecret}-{rawRequestBody}")
   *
   * No anti-replay mechanism — just hash comparison.
   * Returns true if valid, false if invalid/missing token.
   */
  validateWebhook(
    rawBody: string,
    authenticityToken: string | undefined,
  ): boolean {
    if (!authenticityToken || !this.webhookSecret) {
      this.logger.warn('Missing webhook authenticity token or secret — skipping validation')
      return false
    }

    try {
      const expected = createHash('sha256')
        .update(`${this.webhookSecret}-${rawBody}`)
        .digest('hex')

      if (expected.length !== authenticityToken.length) return false
      return timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(authenticityToken),
      )
    } catch (err) {
      this.logger.error(
        `Webhook validation failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return false
    }
  }

  /**
   * Build the customer object for PagBank subscription creation.
   */
  private buildCustomer(params: CreateSubscriptionParams): Record<string, any> {
    const taxIdDigits = (params.payerDocument || '').replace(/\D/g, '')
    const customer: Record<string, any> = {
      name: params.payerName || params.payerEmail.split('@')[0],
      email: params.payerEmail,
      tax_id: taxIdDigits || '00000000000',
      // PagBank requires at least one phone entry. We don't collect phone on the
      // checkout form, so we send a placeholder. The phone is not used for
      // communication; it's a mandatory schema field on the customer object.
      phones: [
        {
          area: '11',
          country: '55',
          number: '999999999',
        },
      ],
    }

    return customer
  }
}
