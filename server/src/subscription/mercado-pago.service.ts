import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common'
import MercadoPagoConfig, { PreApproval } from 'mercadopago'
import { createHash, timingSafeEqual } from 'crypto'

interface MercadoPagoSubscriptionResponse {
  id: string
  status: string
  init_point?: string
  preapproval_plan_id?: string
  payer_email?: string
  reason?: string
  external_reference?: string
  next_payment_date?: string
  summarized?: {
    last_modified?: string
    charged_quantity?: number
    charges_detail?: Array<{
      status: string
      last_modified: string
      type: string
    }>
  }
}

// Minimal MP webhook event shape relevant to subscriptions
export interface MercadoPagoWebhookEvent {
  type: string
  action?: string
  data?: {
    id: string
  }
  /** MP sometimes sends the full resource inside the notification */
  resource?: string
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name)
  private readonly accessToken: string
  private readonly client: MercadoPagoConfig
  private readonly webhookSecret: string
  private readonly mpApiBase = 'https://api.mercadopago.com'

  constructor() {
    this.accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? ''
    if (!this.accessToken) {
      this.logger.warn(
        'MERCADO_PAGO_ACCESS_TOKEN is not set — Mercado Pago integration will fail at runtime',
      )
    }
    this.webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? ''
    this.client = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: { timeout: 15000 },
    })
  }

  /**
   * Create a Mercado Pago subscription (preapproval) for a given plan.
   *
   * IMPORTANT: We do NOT pass preapproval_plan_id — the existing MP plans have
   * payment_types with empty objects, which forces card_token_id to be required.
   * Instead, we pass auto_recurring directly, which works identically for the
   * redirect-based Checkout Pro flow and bypasses any plan misconfiguration.
   *
   * Returns the subscription object with an `init_point` URL.
   */
  async createSubscription(
    planId: string,
    payerEmail: string,
    backUrl: string,
    planPrice: number,
    planSlug: string,
    planName: string,
    cardTokenId?: string,
  ): Promise<MercadoPagoSubscriptionResponse> {
    try {
      const body: Record<string, any> = {
        reason: `Mythrion Premium - ${planName}`,
        payer_email: payerEmail,
        back_url: backUrl,
      }

      if (cardTokenId) {
        // When a card token is provided, the payer has already authorized
        // the recurring charges upfront. Matching the MP API cURL example
        // which uses status: "authorized" with card_token_id.
        // MP will return status: "pending" regardless, but sending
        // "authorized" is required for the card token to be accepted.
        body.card_token_id = cardTokenId
        body.status = 'authorized'
      } else {
        // Redirect-based Checkout Pro flow — MP collects card details
        // on their hosted checkout page
        const frequency = planSlug === 'annual' ? 1 : 1
        const frequencyType = planSlug === 'annual' ? 'years' : 'months'

        body.auto_recurring = {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: planPrice,
          currency_id: 'BRL',
        }
        body.status = 'pending'
      }

      const jsonBody = JSON.stringify(body)
      this.logger.log(`Creating MP preapproval with body: ${jsonBody}`)

      const response = await fetch(`${this.mpApiBase}/preapproval`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: jsonBody,
      })

      const data = await response.json()

      if (!response.ok) {
        const mpError = JSON.stringify(data)
        this.logger.error(
          `MP API error (${response.status}): ${mpError}`,
        )
        throw new UnprocessableEntityException(
          `Mercado Pago error: ${mpError}`,
        )
      }

      return data as MercadoPagoSubscriptionResponse
    } catch (err: any) {
      // If it's already our UnprocessableEntityException, re-throw
      if (err instanceof UnprocessableEntityException) throw err

      const mpError = err?.message || JSON.stringify(err)
      this.logger.error(`Failed to create MP subscription: ${mpError}`)
      throw new UnprocessableEntityException(
        `Mercado Pago error: ${mpError}`,
      )
    }
  }

  /**
   * Cancel a Mercado Pago subscription.
   */
  async cancelSubscription(mpSubscriptionId: string): Promise<void> {
    try {
      const preApproval = new PreApproval(this.client)
      await preApproval.update({
        id: mpSubscriptionId,
        body: { status: 'cancelled' },
      })
      this.logger.log(`Cancelled MP subscription ${mpSubscriptionId}`)
    } catch (err: any) {
      const mpError =
        err?.response?.data?.message ||
        err?.cause?.[0]?.description ||
        err?.message ||
        JSON.stringify(err)
      this.logger.error(`Failed to cancel MP subscription ${mpSubscriptionId}: ${mpError}`)
      throw new UnprocessableEntityException('Failed to cancel subscription')
    }
  }

  /**
   * Fetch a Mercado Pago subscription by its MP ID.
   */
  async getSubscription(
    mpSubscriptionId: string,
  ): Promise<MercadoPagoSubscriptionResponse> {
    try {
      const preApproval = new PreApproval(this.client)
      const response = await preApproval.get({ id: mpSubscriptionId })
      return response as unknown as MercadoPagoSubscriptionResponse
    } catch (err: any) {
      const mpError =
        err?.response?.data?.message ||
        err?.cause?.[0]?.description ||
        err?.message ||
        JSON.stringify(err)
      this.logger.error(`Failed to fetch MP subscription ${mpSubscriptionId}: ${mpError}`)
      throw new UnprocessableEntityException('Failed to fetch subscription')
    }
  }

  /**
   * Validate an incoming Mercado Pago webhook using HMAC-SHA256.
   *
   * MP sends the signature in the `x-signature` header:
   *   ts=<timestamp>,v1=<hmac>
   *
   * The HMAC is computed over:
   *   "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
   *
   * Returns true if valid, false if invalid/missing signature.
   */
  validateWebhook(
    signatureHeader: string | undefined,
    dataId: string | undefined,
    requestId: string | undefined,
  ): boolean {
    if (!signatureHeader || !this.webhookSecret) {
      this.logger.warn('Missing webhook signature or secret — skipping validation')
      return false
    }

    try {
      // Parse the x-signature header: ts=<ts>,v1=<hmac>
      const parts = signatureHeader.split(',').reduce(
        (acc, part) => {
          const [key, value] = part.split('=')
          if (key && value) acc[key.trim()] = value.trim()
          return acc
        },
        {} as Record<string, string>,
      )

      const ts = parts['ts']
      const hmac = parts['v1']
      if (!ts || !hmac) return false

      // Anti-replay: reject signatures older than 5 minutes
      const timestamp = parseInt(ts, 10)
      if (Number.isNaN(timestamp)) return false
      const age = Date.now() - timestamp * 1000
      if (age > 5 * 60 * 1000 || age < 0) {
        this.logger.warn('Webhook signature timestamp is too old or in the future')
        return false
      }

      // Build the message to verify
      const message = `id:${dataId ?? ''};request-id:${requestId ?? ''};ts:${ts};`

      // Compute expected HMAC
      const expectedHmac = createHash('sha256')
        .update(message + this.webhookSecret)
        .digest('hex')

      // Constant-time comparison
      if (expectedHmac.length !== hmac.length) return false
      return timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(hmac))
    } catch (err) {
      this.logger.error(
        `Webhook signature validation failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return false
    }
  }
}
