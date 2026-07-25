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
  private readonly client: MercadoPagoConfig
  private readonly webhookSecret: string

  constructor() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
    if (!accessToken) {
      this.logger.warn(
        'MERCADO_PAGO_ACCESS_TOKEN is not set — Mercado Pago integration will fail at runtime',
      )
    }
    this.webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? ''
    this.client = new MercadoPagoConfig({
      accessToken: accessToken ?? '',
      options: { timeout: 15000 },
    })
  }

  /**
   * Create a Mercado Pago subscription (preapproval) for a given plan.
   * Returns the subscription object with an `init_point` URL.
   */
  async createSubscription(
    planId: string,
    payerEmail: string,
    backUrl: string,
  ): Promise<MercadoPagoSubscriptionResponse> {
    try {
      const preApproval = new PreApproval(this.client)
      const response = await preApproval.create({
        body: {
          preapproval_plan_id: planId,
          payer_email: payerEmail,
          back_url: backUrl,
          status: 'pending',
          reason: 'Mythrion Premium',
        },
      })
      return response as unknown as MercadoPagoSubscriptionResponse
    } catch (err: any) {
      const mpError =
        err?.response?.data?.message ||
        err?.cause?.[0]?.description ||
        err?.message ||
        JSON.stringify(err)
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
