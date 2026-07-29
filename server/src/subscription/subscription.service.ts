import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MercadoPagoService } from './mercado-pago.service.js'
import { createHash, randomBytes } from 'crypto'

type SubscriptionStatus = 'PENDING' | 'AUTHORIZED' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED'

export interface CreateSubscriptionResult {
  /** The Mercado Pago Checkout Pro redirect URL */
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
  mpSubscriptionId: string | null
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

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoService,
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
   *   3. Create the subscription in Mercado Pago
   *   4. Store the UserSubscription row locally
   *   5. Return the MP checkout URL
   */
  async createSubscription(
    userId: string,
    planId: string,
    email: string,
    cardTokenId?: string,
    payerName?: string,
    payerDocument?: string,
  ): Promise<CreateSubscriptionResult> {
    // Check for existing active subscription
    const existing = await this.prisma.userSubscription.findUnique({
      where: { userId },
    })
    if (existing && ['AUTHORIZED', 'ACTIVE', 'GRACE'].includes(existing.status)) {
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
      `Creating subscription - plan: ${plan.slug}, price (cents): ${plan.price}, ` +
      `transaction_amount (reais): ${plan.price / 100}`,
    )

    // Build the back_url for MP redirect after checkout
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
    const backUrl = `${frontendUrl}/subscription/success`

    // Create subscription in Mercado Pago
    // We pass the plan price/slug/name so MP can build auto_recurring directly
    // (bypassing preapproval_plan_id which has misconfigured payment_types)
    const mpSubscription = await this.mp.createSubscription(
      plan.mpPlanId,
      email,
      backUrl,
      plan.price,
      plan.slug,
      plan.name,
      cardTokenId,
      payerName,
      payerDocument,
    )

    // Determine the effective status from MP's response.
    // When using a card token, MP returns status: 'authorized' immediately.
    // When using the redirect flow, MP returns status: 'pending'.
    const mpStatusLower = mpSubscription.status?.toLowerCase()
    const effectiveStatus: SubscriptionStatus =
      mpStatusLower === 'authorized'
        ? 'AUTHORIZED'
        : mpStatusLower === 'pending'
          ? 'PENDING'
          : mpStatusLower === 'cancelled'
            ? 'CANCELLED'
            : 'PENDING'

    this.logger.log(
      `MP subscription created - id: ${mpSubscription.id}, ` +
      `status: ${mpSubscription.status}, ` +
      `effectiveStatus: ${effectiveStatus}, ` +
      `transaction_amount: ${plan.price / 100}`,
    )

    // Upsert the UserSubscription row (create or replace cancelled/expired one)
    const subscription = await this.prisma.userSubscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        mpSubscriptionId: mpSubscription.id,
        status: effectiveStatus,
        currentPeriodStart: effectiveStatus === 'AUTHORIZED' ? new Date() : undefined,
        // Don't reset period/grace dates here — they are only assigned
        // by webhook handlers when MP provides actual values. Resetting
        // them to null on upsert causes P2011 if a prior migration on
        // the target database lacks the NOT NULL → nullable change.
        cancelledAt: null,
      },
      create: {
        userId,
        planId: plan.id,
        mpSubscriptionId: mpSubscription.id,
        status: effectiveStatus,
        currentPeriodStart: effectiveStatus === 'AUTHORIZED' ? new Date() : undefined,
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
      initPoint: mpSubscription.init_point ?? '',
      subscriptionId: subscription.id,
    }
  }

  /** Fetch the current user's subscription with plan + recent invoices. */
  async getMySubscription(userId: string): Promise<MySubscriptionResult | null> {
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

    // Auto-repair: if local status is PENDING but we have an mpSubscriptionId,
    // check MP's actual status. This handles the case where a card-token
    // subscription was created before the fix that maps MP's "authorized"
    // response to AUTHORIZED status locally (migration 20260728000004 era).
    if (sub.status === 'PENDING' && sub.mpSubscriptionId) {
      try {
        const mpSub = await this.mp.getSubscription(sub.mpSubscriptionId)
        if (mpSub.status === 'authorized') {
          const now = new Date()
          const nextPayment = mpSub.next_payment_date
            ? new Date(mpSub.next_payment_date)
            : null
          sub = await this.prisma.userSubscription.update({
            where: { userId },
            data: {
              status: 'AUTHORIZED',
              currentPeriodStart: now,
              currentPeriodEnd: nextPayment,
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
          this.logger.log(`Auto-repaired subscription ${sub.mpSubscriptionId} from PENDING to AUTHORIZED`)
        }
      } catch (err) {
        // MP API failure — just serve stale data, don't block the user
        this.logger.warn(
          `Failed to check MP status for subscription ${sub.mpSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    return {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      mpSubscriptionId: sub.mpSubscriptionId,
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
   * current billing period ends. The subscription is cancelled in Mercado
   * Pago to stop future billing, but the local status stays unchanged.
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

    // Mark as pending cancellation FIRST, before cancelling in MP,
    // so that any subscription_cancelled webhook from MP sees the flag
    // and keeps the user's status intact.
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
    })

    // Cancel in MP (stops future billing, but MP keeps the subscription
    // active until the current period ends; MP will send a
    // subscription_cancelled webhook)
    if (sub.mpSubscriptionId) {
      await this.mp.cancelSubscription(sub.mpSubscriptionId)
    }

    this.logger.log(`Subscription ${sub.id} scheduled for cancellation at period end`)
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
   * Tokenizes the new card client-side and sends the token to MP.
   */
  async updatePaymentMethod(
    userId: string,
    cardTokenId: string,
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
    if (!sub.mpSubscriptionId) {
      throw new UnprocessableEntityException(
        'Subscription has no Mercado Pago reference — cannot update payment method.',
      )
    }

    await this.mp.updatePaymentMethod(
      sub.mpSubscriptionId,
      cardTokenId,
      payerName,
      payerDocument,
    )

    this.logger.log(`Updated payment method for subscription ${sub.id} (MP: ${sub.mpSubscriptionId})`)
  }

  // ─── Webhook processing ──────────────────────────────────────────────

  /**
   * Process an incoming Mercado Pago webhook event.
   * Returns the action taken (or 'noop' if nothing changed).
   */
  async processWebhook(event: {
    type: string
    action?: string
    data?: { id: string }
  }): Promise<string> {
    const { type, action, data } = event

    this.logger.log(
      `Processing webhook: type="${type}" action="${action ?? '?'}" data.id="${data?.id ?? '?'}"`,
    )

    switch (type) {
      case 'subscription_authorized':
        return this.handleSubscriptionAuthorized(data?.id)
      case 'subscription_activated':
        return this.handleSubscriptionActivated(data?.id)
      case 'subscription_cancelled':
        return this.handleSubscriptionCancelled(data?.id)
      case 'subscription_updated':
        return this.handleSubscriptionUpdated(data?.id)
      case 'authorized_payment':
      case 'payment':
        return this.handlePaymentEvent(data?.id)
      default:
        this.logger.debug(`Unhandled webhook type: ${type}`)
        return 'noop'
    }
  }

  private async handleSubscriptionAuthorized(
    mpSubscriptionId: string | undefined,
  ): Promise<string> {
    if (!mpSubscriptionId) return 'noop'

    try {
      // Fetch the subscription from MP to get status details
      const mpSub = await this.mp.getSubscription(mpSubscriptionId)
      const now = new Date()
      const nextPayment = mpSub.next_payment_date
        ? new Date(mpSub.next_payment_date)
        : null

      await this.prisma.userSubscription.update({
        where: { mpSubscriptionId },
        data: {
          status: 'AUTHORIZED',
          currentPeriodStart: now,
          currentPeriodEnd: nextPayment,
        },
      })
      this.logger.log(`Subscription ${mpSubscriptionId} authorized`)
      return 'authorized'
    } catch (err) {
      this.logger.error(
        `Failed to process subscription_authorized for ${mpSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  private async handleSubscriptionActivated(
    mpSubscriptionId: string | undefined,
  ): Promise<string> {
    if (!mpSubscriptionId) return 'noop'

    try {
      const mpSub = await this.mp.getSubscription(mpSubscriptionId)
      const nextPayment = mpSub.next_payment_date
        ? new Date(mpSub.next_payment_date)
        : null

      await this.prisma.userSubscription.update({
        where: { mpSubscriptionId },
        data: {
          status: 'ACTIVE',
          graceEndsAt: null,
          currentPeriodEnd: nextPayment,
        },
      })
      this.logger.log(`Subscription ${mpSubscriptionId} activated`)
      return 'activated'
    } catch (err) {
      this.logger.error(
        `Failed to process subscription_activated for ${mpSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  private async handleSubscriptionCancelled(
    mpSubscriptionId: string | undefined,
  ): Promise<string> {
    if (!mpSubscriptionId) return 'noop'

    try {
      // Check if the user initiated this cancellation (cancelAtPeriodEnd was set).
      // If so, retain the current status — the user keeps access until the
      // current billing period ends. If not (MP auto-cancelled after retries
      // exhausted), immediately mark as CANCELLED.
      const existing = await this.prisma.userSubscription.findUnique({
        where: { mpSubscriptionId },
        select: { cancelAtPeriodEnd: true, currentPeriodEnd: true },
      })

      if (existing?.cancelAtPeriodEnd) {
        this.logger.log(
          `Subscription ${mpSubscriptionId} cancelled at period end (user-initiated, keeping status until ${existing.currentPeriodEnd?.toISOString() ?? '?'})`,
        )
        return 'cancelled_at_period_end'
      }

      await this.prisma.userSubscription.update({
        where: { mpSubscriptionId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })
      this.logger.log(`Subscription ${mpSubscriptionId} cancelled (external)`)
      return 'cancelled'
    } catch (err) {
      this.logger.error(
        `Failed to process subscription_cancelled for ${mpSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  private async handleSubscriptionUpdated(
    mpSubscriptionId: string | undefined,
  ): Promise<string> {
    if (!mpSubscriptionId) return 'noop'

    try {
      const mpSub = await this.mp.getSubscription(mpSubscriptionId)

      // If MP status is 'cancelled', mirror locally
      if (mpSub.status === 'cancelled') {
        return this.handleSubscriptionCancelled(mpSubscriptionId)
      }

      // If MP status is 'authorized' but local is still PENDING, advance
      // (catches cases where the authorized webhook was missed)
      const localSub = await this.prisma.userSubscription.findUnique({
        where: { mpSubscriptionId },
        select: { status: true },
      })

      if (localSub && localSub.status === 'PENDING' && mpSub.status === 'authorized') {
        return this.handleSubscriptionAuthorized(mpSubscriptionId)
      }

      const nextPayment = mpSub.next_payment_date
        ? new Date(mpSub.next_payment_date)
        : null
      if (nextPayment) {
        await this.prisma.userSubscription.update({
          where: { mpSubscriptionId },
          data: { currentPeriodEnd: nextPayment },
        })
      }

      return 'updated'
    } catch (err) {
      this.logger.error(
        `Failed to process subscription_updated for ${mpSubscriptionId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
  }

  /** Grace period duration in days for payment failures */
  private readonly PAYMENT_FAILURE_GRACE_DAYS = 7

  /**
   * Handle an authorized_payment or payment webhook event.
   *
   * Fetches the charge details from MP and acts on the outcome:
   *   - Approved  → create/update invoice, reactivate from GRACE, extend period
   *   - Rejected  → transition to GRACE with a payment-failure grace period
   *   - Refunded  → log but don't change subscription status
   *   - Other     → log and skip
   */
  private async handlePaymentEvent(
    chargeId: string | undefined,
  ): Promise<string> {
    if (!chargeId) return 'noop'

    try {
      // Fetch the charge details from MP to determine actual status
      const charge = await this.mp.getAuthorizedPayment(chargeId)
      const chargeStatus = charge.status?.toLowerCase()
      const preapprovalId = charge.preapproval_id

      this.logger.log(
        `Payment event: chargeId=${chargeId} status="${chargeStatus}" preapproval="${preapprovalId}" amount=${charge.transaction_amount}`,
      )

      if (!preapprovalId) {
        this.logger.warn(`Authorized payment ${chargeId} has no preapproval_id, cannot link to subscription`)
        return 'noop'
      }

      // Find the local subscription by MP subscription ID
      const sub = await this.prisma.userSubscription.findUnique({
        where: { mpSubscriptionId: preapprovalId },
        select: { id: true, status: true, planId: true },
      })

      if (!sub) {
        this.logger.warn(`No local subscription found for MP preapproval ${preapprovalId}`)
        return 'noop'
      }

      switch (chargeStatus) {
        case 'approved': {
          // Charge was successful — create/update invoice and reactivate
          const invoiceAmount = Math.round(charge.transaction_amount * 100)
          const now = new Date()

          // Upsert the invoice
          await this.prisma.subscriptionInvoice.upsert({
            where: { mpInvoiceId: chargeId },
            update: {
              status: 'paid',
              amount: invoiceAmount,
              paidAt: now,
            },
            create: {
              subscriptionId: sub.id,
              mpInvoiceId: chargeId,
              amount: invoiceAmount,
              currency: charge.currency_id ?? 'BRL',
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
            this.logger.log(`Subscription ${sub.id} reactivated from GRACE after successful payment`)
          }

          // Extend period end if MP provides a next payment date
          if (charge.next_payment_date) {
            await this.prisma.userSubscription.update({
              where: { id: sub.id },
              data: {
                currentPeriodEnd: new Date(charge.next_payment_date),
              },
            })
          }

          this.logger.log(`Payment approved for subscription ${sub.id}: R$${(invoiceAmount / 100).toFixed(2)}`)
          return 'payment_approved'
        }

        case 'rejected':
        case 'cc_rejected':
        case 'charged_off': {
          // Payment was rejected — move to GRACE if not already
          if (sub.status !== 'GRACE' && sub.status !== 'CANCELLED' && sub.status !== 'EXPIRED') {
            const graceEnd = new Date()
            graceEnd.setDate(graceEnd.getDate() + this.PAYMENT_FAILURE_GRACE_DAYS)

            await this.prisma.userSubscription.update({
              where: { id: sub.id },
              data: {
                status: 'GRACE',
                graceEndsAt: graceEnd,
              },
            })

            // Create a failed invoice record for audit trail
            const invoiceAmount = Math.round(charge.transaction_amount * 100)
            await this.prisma.subscriptionInvoice.upsert({
              where: { mpInvoiceId: chargeId },
              update: {
                status: 'failed',
                amount: invoiceAmount,
              },
              create: {
                subscriptionId: sub.id,
                mpInvoiceId: chargeId,
                amount: invoiceAmount,
                currency: charge.currency_id ?? 'BRL',
                status: 'failed',
              },
            })

            this.logger.warn(
              `Payment rejected for subscription ${sub.id}: moving to GRACE until ${graceEnd.toISOString()}`,
            )
          }
          return 'payment_rejected'
        }

        case 'refunded': {
          // Payment was refunded — log it
          this.logger.log(`Payment ${chargeId} was refunded for subscription ${sub.id}`)
          return 'payment_refunded'
        }

        default: {
          // Other statuses (pending, in_process, in_mediation, etc.) — log and skip
          this.logger.debug(`Unhandled payment status "${chargeStatus}" for charge ${chargeId}`)
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
      this.logger.log(`Expired ${expired.count} cancel-at-period-end subscription(s)`)
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
      this.logger.log(`Expired ${expired.count} grace-period subscription(s)`)
    }
    return expired.count
  }
}
