import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { I18nService } from 'nestjs-i18n'
import { AdminService } from './admin.service.js'
import { SubscriptionService } from '../subscription/subscription.service.js'
import { PrismaService } from '../prisma.service.js'
import { parsePlanLimits } from '../subscription/plan-limits.js'
import { PLAN_LIMIT_RESOURCE_KEY, PlanLimitResource } from './plan-limit.decorator.js'
import type { AuthenticatedRequest } from './AuthenticatedRequest.js'

/**
 * Enforces per-plan caps on resource creation. The resource ('campaign' or
 * 'template') comes from @PlanLimit() metadata; the cap is read fresh from the
 * plan row (never from cache) and compared against the user's OWNED resources
 * at create/clone time. Limits are evaluated independently of whether the
 * subscription is still active — SubscriptionGuard owns the existence check.
 */
@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminService: AdminService,
    private readonly subscriptionService: SubscriptionService,
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<PlanLimitResource>(
      PLAN_LIMIT_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!resource) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request.user

    if (!user?.email) {
      throw new ForbiddenException(this.i18n.t('subscription.authRequired'))
    }

    // Admin/early-access bypass — same rule as SubscriptionGuard.
    if (
      this.adminService.isAdmin(user.email) ||
      this.adminService.isEarlyAccess(user.email)
    ) {
      return true
    }

    // The user's current plan determines the cap. No plan => no caps.
    const subscription = await this.subscriptionService.getMySubscription(user.sub)
    const slug = subscription?.plan?.slug
    if (!slug) return true

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { slug },
      select: { limits: true },
    })
    const limits = parsePlanLimits(plan?.limits)
    const max = resource === 'campaign' ? limits?.maxCampaigns : limits?.maxTemplates
    if (max == null) return true

    const owned =
      resource === 'campaign'
        ? await this.prisma.adventure.count({ where: { ownerId: user.sub } })
        : await this.prisma.template.count({ where: { ownerId: user.sub } })

    if (owned >= max) {
      throw new ForbiddenException(
        this.i18n.t(
          resource === 'campaign'
            ? 'subscription.campaignLimitReached'
            : 'subscription.templateLimitReached',
        ),
      )
    }

    return true
  }
}
