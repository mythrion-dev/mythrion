import { Injectable } from '@nestjs/common'
import { AdminService } from './admin.service.js'
import {
  SubscriptionService,
  type MySubscriptionResult,
} from '../subscription/subscription.service.js'
import { parsePlanLimits } from '../subscription/plan-limits.js'
import { PrismaService } from '../prisma.service.js'

export type UserRole = 'admin' | 'early_access' | 'user'

export interface SubscriptionInfo {
  plan: { slug: string; name: string; price: number } | null
  status: string | null
  expiresAt: string | null
}

export interface EntitlementInfo {
  hasActiveSubscription: boolean
  canUseSubscriptionFeatures: boolean
}

export interface LimitInfo {
  maxCampaigns: number | null
  maxTemplates: number | null
}

/**
 * Single normalized authorization result for the frontend. PostgreSQL is the
 * source of truth: role/early-access come from env vars (AdminService) and the
 * subscription/limits come from the DB. No client-supplied value is trusted.
 */
export interface PermissionResult {
  role: UserRole
  earlyAccess: boolean
  subscription: SubscriptionInfo
  entitlements: EntitlementInfo
  limits: LimitInfo
}

@Injectable()
export class PermissionService {
  constructor(
    private readonly adminService: AdminService,
    private readonly subscriptionService: SubscriptionService,
    private readonly prisma: PrismaService,
  ) {}

  async getPermissions(userId: string, email: string): Promise<PermissionResult> {
    const isAdmin = this.adminService.isAdmin(email)
    const isEarlyAccess = this.adminService.isEarlyAccess(email)
    let role: UserRole
    if (isAdmin) {
      role = 'admin'
    } else if (isEarlyAccess) {
      role = 'early_access'
    } else {
      role = 'user'
    }

    // Single entitlement read: plan/status/expiresAt and the active boolean
    // all come from the same getMySubscription result so they can never
    // disagree within one response.
    const sub = await this.subscriptionService.getMySubscription(userId)
    const hasActiveSubscription = sub?.hasActiveSubscription ?? false

    const plan = sub?.plan ?? null
    const status = sub?.status ?? null
    const expiresAt = this.toIso(this.expiryOf(sub))

    return {
      role,
      earlyAccess: isEarlyAccess,
      subscription: { plan, status, expiresAt },
      entitlements: {
        hasActiveSubscription,
        canUseSubscriptionFeatures:
          hasActiveSubscription || isAdmin || isEarlyAccess,
      },
      limits: await this.loadLimits(plan?.slug ?? null),
    }
  }

  /** Limits are read fresh from the plan row — never cached, never stale. */
  private async loadLimits(slug: string | null): Promise<LimitInfo> {
    if (!slug) return { maxCampaigns: null, maxTemplates: null }
    const row = await this.prisma.subscriptionPlan.findUnique({
      where: { slug },
      select: { limits: true },
    })
    const parsed = parsePlanLimits(row?.limits)
    return {
      maxCampaigns: parsed?.maxCampaigns ?? null,
      maxTemplates: parsed?.maxTemplates ?? null,
    }
  }

  /** Expiry relevant to the current period: grace end during GRACE, else period end. */
  private expiryOf(sub: MySubscriptionResult | null): Date | null {
    if (!sub) return null
    return sub.status === 'GRACE' ? sub.graceEndsAt : sub.currentPeriodEnd
  }

  /** Coerce a Date or ISO string (Redis round-trip) to an ISO string, or null. */
  private toIso(value: Date | string | null | undefined): string | null {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
}
