import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  Inject,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { createHash, randomBytes } from 'crypto'
import type {
  PaymentGateway,
  CreateSubscriptionResult as GatewayCreateResult,
} from './payment-gateway.interface.js'
import { PAYMENT_GATEWAY } from './payment-gateway.interface.js'

type SubscriptionStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'ACTIVE'
  | 'GRACE'
  | 'EXPIRED'
  | 'CANCELLED'

export interface CreateSubscriptionResult {
  /** The payment gateway redirect URL (empty for card flow) */
  initPoint: string
  /** Our internal subscription ID */
  subscriptionId: string
}

export interface MySubscriptionResult {
  id: string
  plan: {
    slug: string
    name: string
    price: number
  }
  status: string
  pgSubscriptionId: string | null
  graceEndsAt: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelledAt: Date | null
  cancelAtPeriodEnd: boolean
  createdAt: Date
  invoices: Array<{
    id: string
    amount: number
    currency: string
    status: string
    paidAt: Date | null
    dueDate: Date | null
    createdAt: Date
  }>
}

/** Internal mapping: PagBank status → internal SubscriptionStatus */
const GATEWAY_STATUS_MAP: Record<string, SubscriptionStatus> = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  OVERDUE: 'GRACE',
  PENDING_ACTION: 'PENDING',
  SUSPENDED: 'GRACE',
  CANCELED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  TRIAL: 'ACTIVE',
}

function mapGatewayStatus(gatewayStatus: string): SubscriptionStatus {
  return GATEWAY_STATUS_MAP[gatewayStatus] ?? 'PENDING'
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  /** Return all subscription plans (sorted by price ascending). */
  async listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    })
  }

  /**
   * Create a new subscription for a user.
   * Steps:
   *   1. Verify user doesn't already have an active subscription
   *   2. Look up the plan
   *   3. Create the subscription in PagBank
   *   4. Store the UserSubscription row locally
   *   5. Return the result
   */
  async createSubscription(
    userId: string,
    planId: string,
    email: string,
    cardToken?: string,
    securityCode?: string,
    payerName?: string,
    payerDocument?: string,
    deviceId?: string,
    cardTokenId?: string,
    installments?: number,
  ): Promise<CreateSubscriptionResult> {
    // Check for existing active subscription
    const existing = await this.prisma.userSubscription.findUnique({
      where: { userId },
    })
    if (
      existing &&
      ['AUTHORIZED', 'ACTIVE', 'GRACE'].includes(existing.status)
    ) {
      throw new UnprocessableEntityException(
        'You already have an active subscription. Cancel it first before creating a new one.',
      )
    }

    // Look up the plan
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    })
    if (!plan) {
      throw new NotFoundException(`Subscription plan "${planId}" not found`)
    }

    this.logger.log(
      `Creating subscription - plan: ${plan.slug}, price (cents): ${plan.price}`,
    )

    // Build the back_url for PagBank redirect after checkout
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
    const backUrl = `${frontendUrl}/subscription/success`

    // Create subscription in PagBank via the payment gateway
    const result = await this.gateway.createSubscription({
      planId: plan.pgPlanId,
      planPrice: plan.price,
      planSlug: plan.slug,
      planName: plan.name,
      payerEmail: email,
      backUrl,
      cardToken,
      cardTokenId,
      securityCode,
      payerName,
      payerDocument,
      externalReference: userId,
      deviceId,
      ...(installments !== undefined ? { installments } : {}),
    })

    // Map gateway status to internal status
    const effectiveStatus = mapGatewayStatus(result.status)

    this.logger.log(
      `Gateway subscription created - id: ${result.id}, ` +
        `status: ${result.status}, ` +
        `effectiveStatus: ${effectiveStatus}` +
        (result.customerId ? `, customerId: ${result.customerId}` : ''),
    )

    // Upsert the UserSubscription row (create or replace cancelled/expired one)
    const subscription = await this.prisma.userSubscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        pgSubscriptionId: result.id,
        pgCustomerId: result.customerId ?? null,
        status: effectiveStatus,
        currentPeriodStart:
          effectiveStatus === 'AUTHORIZED' || effectiveStatus === 'ACTIVE'
            ? new Date()
            : undefined,
        cancelledAt: null,
      },
      create: {
        userId,
        planId: plan.id,
        pgSubscriptionId: result.id,
        pgCustomerId: result.customerId ?? null,
        status: effectiveStatus,
        currentPeriodStart:
          effectiveStatus === 'AUTHORIZED' || effectiveStatus === 'ACTIVE'
            ? new Date()
            : undefined,
      },
    })

    // Save payer name to user profile for future reference (only if blank)
    if (payerName) {
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      })
      if (!existingUser?.displayName) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { displayName: payerName.trim() },
        })
      }
    }

    return {
      initPoint: result.initPoint,
      subscriptionId: subscription.id,
    }
  }

  /** Fetch the current user's subscription with plan + recent invoices. */
  async getMySubscription(
    userId: string,
  ): Promise<MySubscriptionResult | null> {
    let sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: {
        plan: { select: { slug: true, name: true, price: true } },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paidAt: true,
            dueDate: true,
            createdAt: true,
          },
        },
      },
    })

    if (!sub) return null

    // Auto-repair: if local status is PENDING or GRACE but we have a pgSubscriptionId,
    // check PagBank's actual status (the gateway may have advanced the subscription
    // via webhook or recurring payment).
    if (
      (sub.status === 'PENDING' || sub.status === 'GRACE') &&
      sub.pgSubscriptionId
    ) {
      try {
        const gatewaySub = await this.gateway.getSubscription(
          sub.pgSubscriptionId,
        )
        const mappedStatus = mapGatewayStatus(gatewaySub.status)
        if (mappedStatus !== 'PENDING') {
          const now = new Date()
          const nextPayment = gatewaySub.nextPaymentDate
            ? new Date(gatewaySub.nextPaymentDate)
            : null
          sub = await this.prisma.userSubscription.update({
            where: { userId },
            data: {
              status: mappedStatus,
              currentPeriodStart: now,
              currentPeriodEnd: nextPayment,
              pgCustomerId: gatewaySub.customerId ?? sub.pgCustomerId,
            },
            include: {
              plan: { select: { slug: true, name: true, price: true } },
              invoices: {
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                  id: true,
                  amount: true,
                  currency: true,
                  status: true,
                  paidAt: true,
                  dueDate: true,
                  createdAt: true,
                },
              },
            },
          })
          this.logger.log(
            `Auto-repaired subscription ${sub.pgSubscriptionId} from PENDING to ${mappedStatus}`,
          )
        }
      } catch (err) {
        // Gateway API failure — just serve stale data, don't block the user
        this.logger.warn(
          `Failed to check gateway status for subscription ${sub.pgSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      pgSubscriptionId: sub.pgSubscriptionId,
      graceEndsAt: sub.graceEndsAt,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelledAt: sub.cancelledAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      createdAt: sub.createdAt,
      invoices: sub.invoices,
    }
  }

  /**
   * Cancel the current user's subscription.
   *
   * Sets cancelAtPeriodEnd to true so the user retains access until the
   * current billing period ends. The subscription is cancelled in PagBank
   * to stop future billing, but the local status stays unchanged.
   * A periodic sweep (expireCancelledSubscriptions) transitions it to
   * EXPIRED once currentPeriodEnd passes.
   */
  async cancelSubscription(userId: string): Promise<void> {
    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
    })
    if (!sub) {
      throw new NotFoundException('No subscription found to cancel')
    }
    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
      throw new UnprocessableEntityException(
        `Subscription is already ${sub.status.toLowerCase()}`,
      )
    }
    if (sub.cancelAtPeriodEnd) {
      throw new UnprocessableEntityException(
        'Subscription is already scheduled for cancellation at period end',
      )
    }

    // Mark as pending cancellation FIRST, before cancelling in PagBank,
    // so that any subscription.canceled webhook from PagBank sees the flag
    // and keeps the user's status intact.
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    })

    // Cancel in PagBank (stops future billing)
    if (sub.pgSubscriptionId) {
      await this.gateway.cancelSubscription(sub.pgSubscriptionId)
    }

    this.logger.log(
      `Subscription ${sub.id} scheduled for cancellation at period end`,
    )
  }

  /**
   * Check if a user has an active subscription.
   * Active = AUTHORIZED, ACTIVE, or GRACE status.
   * Admins are always considered to have an active subscription.
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
      select: { status: true },
    })
    if (!sub) return false
    return ['AUTHORIZED', 'ACTIVE', 'GRACE'].includes(sub.status)
  }

  /**
   * Update the payment method (card) for the current user's subscription.
   * Requires the user to have a valid pgCustomerId stored from subscription creation.
   */
  async updatePaymentMethod(
    userId: string,
    cardToken: string,
    payerName?: string,
    payerDocument?: string,
  ): Promise<void> {
    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId },
    })
    if (!sub) {
      throw new NotFoundException('No subscription found')
    }
    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
      throw new UnprocessableEntityException(
        `Cannot update payment method on a ${sub.status.toLowerCase()} subscription.`,
      )
    }
    if (!sub.pgSubscriptionId) {
      throw new UnprocessableEntityException(
        'Subscription has no PagBank reference — cannot update payment method.',
      )
    }
    if (!sub.pgCustomerId) {
      throw new UnprocessableEntityException(
        'Subscription has no PagBank customer ID — cannot update payment method.',
      )
    }

    await this.gateway.updatePaymentMethod(
      sub.pgSubscriptionId,
      sub.pgCustomerId,
      cardToken,
    )

    this.logger.log(
      `Updated payment method for subscription ${sub.id} (PG: ${sub.pgSubscriptionId})`,
    )
  }

  // ─── Webhook processing ──────────────────────────────────────────────

  /**
   * Validate and process an incoming PagBank webhook event.
   * Returns the action taken (or 'noop' if nothing changed).
   *
   * Accepts raw body for signature validation and authenticity token.
   */
  async processWebhook(
    rawBody: string,
    authenticityToken: string | undefined,
    event: {
      type: string
      action?: string
      data?: { id: string }
    },
  ): Promise<string> {
    // Validate HMAC signature
    const isValid = this.gateway.validateWebhook(rawBody, authenticityToken)

    if (!isValid) {
      this.logger.warn(
        'Webhook signature validation failed — returning 200 to prevent retries',
      )
      return 'invalid_signature'
    }

    const { type, action, data } = event

    this.logger.log(
      `Processing webhook: type="${type}" action="${action ?? '?'}" data.id="${data?.id ?? '?'}"`,
    )

    switch (type) {
      case 'subscription.activated':
        return this.handleSubscriptionActivated(data?.id)
      case 'subscription.canceled':
        return this.handleSubscriptionCancelled(data?.id)
      case 'subscription.recurrence':
        return this.handleSubscriptionRecurrence(data?.id)
      case 'subscription.updated':
        return this.handleSubscriptionUpdated(data?.id)
      case 'charge.created':
        this.logger.debug(`Charge created event for ${data?.id} — no action needed`)
        return 'noop'
      case 'charge.paid':
        return this.handlePaymentEvent(data?.id)
      case 'charge.failed':
        return this.handlePaymentEvent(data?.id)
      case 'charge.refunded':
        this.logger.log(`Charge refunded: ${data?.id}`)
        return 'payment_refunded'
      default:
        this.logger.debug(`Unhandled webhook type: ${type}`)
        return 'noop'
    }
  }

  private async handleSubscriptionActivated(
    pgSubscriptionId: string | undefined,
  ): Promise<string> {
    if (!pgSubscriptionId) return 'noop'

    try {
      const gatewaySub =
        await this.gateway.getSubscription(pgSubscriptionId)
      const nextPayment = gatewaySub.nextPaymentDate
        ? new Date(gatewaySub.nextPaymentDate)
        : null

      await this.prisma.userSubscription.update({
        where: { pgSubscriptionId },
        data: {
          status: 'ACTIVE',
          graceEndsAt: null,
          currentPeriodEnd: nextPayment,
          pgCustomerId: gatewaySub.customerId ?? undefined,
        },
      })
      this.logger.log(`Subscription ${pgSubscriptionId} activated`)
      return 'activated'
    } catch (err) {
      this.logger.error(
        `Failed to process subscription.activated for ${pgSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  private async handleSubscriptionCancelled(
    pgSubscriptionId: string | undefined,
  ): Promise<string> {
    if (!pgSubscriptionId) return 'noop'

    try {
      // Check if the user initiated this cancellation (cancelAtPeriodEnd was set).
      // If so, retain the current status — the user keeps access until the
      // current billing period ends. If not (PagBank auto-cancelled after retries
      // exhausted), immediately mark as CANCELLED.
      const existing = await this.prisma.userSubscription.findUnique({
        where: { pgSubscriptionId },
        select: { cancelAtPeriodEnd: true, currentPeriodEnd: true },
      })

      if (existing?.cancelAtPeriodEnd) {
        this.logger.log(
          `Subscription ${pgSubscriptionId} cancelled at period end (user-initiated, keeping status until ${existing.currentPeriodEnd?.toISOString() ?? '?'})`,
        )
        return 'cancelled_at_period_end'
      }

      await this.prisma.userSubscription.update({
        where: { pgSubscriptionId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })
      this.logger.log(
        `Subscription ${pgSubscriptionId} cancelled (external)`,
      )
      return 'cancelled'
    } catch (err) {
      this.logger.error(
        `Failed to process subscription.canceled for ${pgSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  /**
   * Handle subscription.recurrence event (recurring payment processed).
   * Creates an invoice and reactivates from GRACE if applicable.
   */
  private async handleSubscriptionRecurrence(
    pgSubscriptionId: string | undefined,
  ): Promise<string> {
    if (!pgSubscriptionId) return 'noop'

    try {
      const gatewaySub =
        await this.gateway.getSubscription(pgSubscriptionId)
      const nextPayment = gatewaySub.nextPaymentDate
        ? new Date(gatewaySub.nextPaymentDate)
        : null

      // Reactivate from GRACE if applicable
      const updateData: Record<string, any> = {
        status: 'ACTIVE',
        graceEndsAt: null,
      }
      if (nextPayment) {
        updateData.currentPeriodEnd = nextPayment
      }

      await this.prisma.userSubscription.update({
        where: { pgSubscriptionId },
        data: updateData,
      })
      this.logger.log(
        `Subscription ${pgSubscriptionId} recurred (reactivated from GRACE if applicable)`,
      )
      return 'recurrence_processed'
    } catch (err) {
      this.logger.error(
        `Failed to process subscription.recurrence for ${pgSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  private async handleSubscriptionUpdated(
    pgSubscriptionId: string | undefined,
  ): Promise<string> {
    if (!pgSubscriptionId) return 'noop'

    try {
      const gatewaySub =
        await this.gateway.getSubscription(pgSubscriptionId)

      // If PagBank status is CANCELED, mirror locally
      if (gatewaySub.status === 'CANCELED') {
        return this.handleSubscriptionCancelled(pgSubscriptionId)
      }

      // Sync customer ID if not yet stored
      if (gatewaySub.customerId) {
        await this.prisma.userSubscription.update({
          where: { pgSubscriptionId },
          data: { pgCustomerId: gatewaySub.customerId },
        })
      }

      const mappedStatus = mapGatewayStatus(gatewaySub.status)
      const localSub = await this.prisma.userSubscription.findUnique({
        where: { pgSubscriptionId },
        select: { status: true },
      })

      if (localSub && localSub.status === 'PENDING' && mappedStatus !== 'PENDING') {
        // Advance from PENDING
        const nextPayment = gatewaySub.nextPaymentDate
          ? new Date(gatewaySub.nextPaymentDate)
          : null
        await this.prisma.userSubscription.update({
          where: { pgSubscriptionId },
          data: {
            status: mappedStatus,
            currentPeriodStart: new Date(),
            currentPeriodEnd: nextPayment ?? undefined,
          },
        })
        return 'advanced'
      }

      const nextPayment = gatewaySub.nextPaymentDate
        ? new Date(gatewaySub.nextPaymentDate)
        : null
      if (nextPayment) {
        await this.prisma.userSubscription.update({
          where: { pgSubscriptionId },
          data: { currentPeriodEnd: nextPayment },
        })
      }

      return 'updated'
    } catch (err) {
      this.logger.error(
        `Failed to process subscription.updated for ${pgSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  /** Grace period duration in days for payment failures */
  private readonly PAYMENT_FAILURE_GRACE_DAYS = 7

  /**
   * Handle a charge.paid or charge.failed webhook event.
   *
   * Fetches the charge details from PagBank and acts on the outcome:
   *   - Approved  → create/update invoice, reactivate from GRACE, extend period
   *   - Rejected  → transition to GRACE with a payment-failure grace period
   *   - Other     → log and skip
   */
  private async handlePaymentEvent(
    chargeId: string | undefined,
  ): Promise<string> {
    if (!chargeId) return 'noop'

    try {
      const charge = await this.gateway.getPaymentCharge(chargeId)
      const chargeStatus = charge.status?.toLowerCase()
      const pgSubscriptionId = charge.subscriptionId

      this.logger.log(
        `Payment event: chargeId=${chargeId} status="${chargeStatus}" subscription="${pgSubscriptionId}" amount=${charge.transactionAmount}`,
      )

      if (!pgSubscriptionId) {
        this.logger.warn(
          `Payment charge ${chargeId} has no subscription_id, cannot link to subscription`,
        )
        return 'noop'
      }

      // Find the local subscription by PagBank subscription ID
      const sub = await this.prisma.userSubscription.findUnique({
        where: { pgSubscriptionId },
        select: { id: true, status: true, planId: true },
      })

      if (!sub) {
        this.logger.warn(
          `No local subscription found for PagBank subscription ${pgSubscriptionId}`,
        )
        return 'noop'
      }

      switch (chargeStatus) {
        case 'paid':
        case 'authorized':
        case 'approved': {
          // Charge was successful — create/update invoice and reactivate
          const invoiceAmount = charge.transactionAmount
          const now = new Date()

          // Upsert the invoice
          await this.prisma.subscriptionInvoice.upsert({
            where: { pgInvoiceId: chargeId },
            update: {
              status: 'paid',
              amount: invoiceAmount,
              paidAt: now,
            },
            create: {
              subscriptionId: sub.id,
              pgInvoiceId: chargeId,
              amount: invoiceAmount,
              currency: charge.currencyId ?? 'BRL',
              status: 'paid',
              paidAt: now,
            },
          })

          // If subscription was in GRACE, reactivate it
          if (sub.status === 'GRACE') {
            await this.prisma.userSubscription.update({
              where: { id: sub.id },
              data: {
                status: 'ACTIVE',
                graceEndsAt: null,
              },
            })
            this.logger.log(
              `Subscription ${sub.id} reactivated from GRACE after successful payment`,
            )
          }

          // Extend period end if PagBank provides a next payment date
          if (charge.nextPaymentDate) {
            await this.prisma.userSubscription.update({
              where: { id: sub.id },
              data: {
                currentPeriodEnd: new Date(charge.nextPaymentDate),
              },
            })
          }

          this.logger.log(
            `Payment approved for subscription ${sub.id}: R$${(invoiceAmount / 100).toFixed(2)}`,
          )
          return 'payment_approved'
        }

        case 'refused':
        case 'rejected':
        case 'failed':
        case 'chargedback': {
          // Payment was rejected — move to GRACE if not already
          if (
            sub.status !== 'GRACE' &&
            sub.status !== 'CANCELLED' &&
            sub.status !== 'EXPIRED'
          ) {
            const graceEnd = new Date()
            graceEnd.setDate(
              graceEnd.getDate() + this.PAYMENT_FAILURE_GRACE_DAYS,
            )

            await this.prisma.userSubscription.update({
              where: { id: sub.id },
              data: {
                status: 'GRACE',
                graceEndsAt: graceEnd,
              },
            })

            // Create a failed invoice record for audit trail
            const invoiceAmount = charge.transactionAmount
            await this.prisma.subscriptionInvoice.upsert({
              where: { pgInvoiceId: chargeId },
              update: {
                status: 'failed',
                amount: invoiceAmount,
              },
              create: {
                subscriptionId: sub.id,
                pgInvoiceId: chargeId,
                amount: invoiceAmount,
                currency: charge.currencyId ?? 'BRL',
                status: 'failed',
              },
            })

            this.logger.warn(
              `Payment rejected for subscription ${sub.id}: moving to GRACE until ${graceEnd.toISOString()}`,
            )
          }
          return 'payment_rejected'
        }

        default: {
          // Other statuses (pending, in_process, etc.) — log and skip
          this.logger.debug(
            `Unhandled payment status "${chargeStatus}" for charge ${chargeId}`,
          )
          return 'noop'
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to process payment event for charge ${chargeId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  // ─── Helper: expire cancel-at-period-end subscriptions ──────────────

  /**
   * Check for any subscriptions with cancelAtPeriodEnd=true that have
   * passed their currentPeriodEnd and expire them.
   * Called from a cron or on webhook. Returns count of expired subs.
   */
  async expireCancelledSubscriptions(): Promise<number> {
    const now = new Date()
    const expired = await this.prisma.userSubscription.updateMany({
      where: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: { lte: now },
        status: { notIn: ['EXPIRED', 'CANCELLED'] },
      },
      data: {
        status: 'EXPIRED',
      },
    })
    if (expired.count > 0) {
      this.logger.log(
        `Expired ${expired.count} cancel-at-period-end subscription(s)`,
      )
    }
    return expired.count
  }

  // ─── Helper: expire grace-period subscriptions ──────────────────────

  /**
   * Check for any subscriptions in GRACE status that have passed their
   * graceEndsAt date and expire them. Called from a cron or on webhook.
   * Returns count of expired subscriptions.
   */
  async expireGraceSubscriptions(): Promise<number> {
    const now = new Date()
    const expired = await this.prisma.userSubscription.updateMany({
      where: {
        status: 'GRACE',
        graceEndsAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
      },
    })
    if (expired.count > 0) {
      this.logger.log(
        `Expired ${expired.count} grace-period subscription(s)`,
      )
    }
    return expired.count
  }
}
