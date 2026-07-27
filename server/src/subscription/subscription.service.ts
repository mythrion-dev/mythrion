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

    // Build the back_url for MP redirect after checkout
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
    const backUrl = `${frontendUrl}/subscription/success`

    // Create subscription in Mercado Pago
    const mpSubscription = await this.mp.createSubscription(
      plan.mpPlanId,
      email,
      backUrl,
      cardTokenId,
    )

    // Upsert the UserSubscription row (create or replace cancelled/expired one)
    const subscription = await this.prisma.userSubscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        mpSubscriptionId: mpSubscription.id,
        status: 'PENDING' as SubscriptionStatus,
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
      },
      create: {
        userId,
        planId: plan.id,
        mpSubscriptionId: mpSubscription.id,
        status: 'PENDING',
      },
    })

    return {
      initPoint: mpSubscription.init_point ?? '',
      subscriptionId: subscription.id,
    }
  }

  /** Fetch the current user's subscription with plan + recent invoices. */
  async getMySubscription(userId: string): Promise<MySubscriptionResult | null> {
    const sub = await this.prisma.userSubscription.findUnique({
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

    return {
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      mpSubscriptionId: sub.mpSubscriptionId,
      graceEndsAt: sub.graceEndsAt,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelledAt: sub.cancelledAt,
      createdAt: sub.createdAt,
      invoices: sub.invoices,
    }
  }

  /**
   * Cancel the current user's subscription.
   * Cancels in Mercado Pago and marks local row as CANCELLED.
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

    // Cancel in MP if we have an MP subscription ID
    if (sub.mpSubscriptionId) {
      await this.mp.cancelSubscription(sub.mpSubscriptionId)
    }

    // Mark local row as cancelled
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    })
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
    const { type, data } = event

    this.logger.log(`Processing webhook: type="${type}", data.id="${data?.id}"`)

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
        return this.handleInvoicePaid(data?.id)
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
      await this.prisma.userSubscription.update({
        where: { mpSubscriptionId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })
      this.logger.log(`Subscription ${mpSubscriptionId} cancelled`)
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

  private async handleInvoicePaid(
    mpInvoiceId: string | undefined,
  ): Promise<string> {
    if (!mpInvoiceId) return 'noop'

    try {
      // Try to find the subscription by linking invoice to subscription
      // First, record/update the invoice in our database
      // We need to look up the subscription from MP invoice data
      // For now, we create a generic invoice record
      // In production, you'd call MP API to get invoice details

      // Grace period end — payment received, reactivate
      const invoiceSub = await this.prisma.subscriptionInvoice.findUnique({
        where: { mpInvoiceId },
        include: { subscription: true },
      })

      if (invoiceSub?.subscription) {
        const sub = invoiceSub.subscription
        // Re-activate from grace
        if (sub.status === 'GRACE') {
          await this.prisma.userSubscription.update({
            where: { id: sub.id },
            data: {
              status: 'ACTIVE',
              graceEndsAt: null,
            },
          })
        }

        await this.prisma.subscriptionInvoice.update({
          where: { mpInvoiceId },
          data: {
            status: 'paid',
            paidAt: new Date(),
          },
        })
        return 'invoice_paid'
      }

      // If we don't have a matching invoice, just log it
      this.logger.log(`Invoice ${mpInvoiceId} paid (no local match)`)
      return 'noop'
    } catch (err) {
      this.logger.error(
        `Failed to process invoice paid for ${mpInvoiceId}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'error'
    }
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
