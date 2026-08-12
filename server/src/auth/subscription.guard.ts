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
import type { AuthenticatedRequest } from './AuthenticatedRequest.js'

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminService: AdminService,
    private readonly subscriptionService: SubscriptionService,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes decorated with @SkipSubscriptionCheck()
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      'skipSubscriptionCheck',
      [context.getHandler(), context.getClass()],
    )
    if (skipCheck) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request.user

    // If no user on the request (not authenticated), block access
    if (!user?.email) {
      throw new ForbiddenException(this.i18n.t('subscription.authRequired'))
    }

    // Layer 1 — Admin/early-access bypass. Both lists are defined in the
    // ADMIN_EMAILS and EARLY_ACCESS_EMAILS environment variables (set in Railway
    // for production), so these checks cannot be bypassed via SQL injection or
    // database compromise. Early access grants the same feature access as admin
    // (e.g. subscription paywall bypass) without admin-panel privileges.
    if (
      this.adminService.isAdmin(user.email) ||
      this.adminService.isEarlyAccess(user.email)
    ) {
      return true
    }

    // Layer 2 — Active subscription check. Distinguish "no subscription at all"
    // from "subscription lapsed" so the user gets the right message and is
    // routed to renew rather than to subscribe fresh.
    const access = await this.subscriptionService.getSubscriptionAccessReason(user.sub)
    if (access === 'none') {
      throw new ForbiddenException(
        this.i18n.t('subscription.activeSubscriptionRequired'),
      )
    }
    if (access === 'expired') {
      throw new ForbiddenException(this.i18n.t('subscription.subscriptionExpired'))
    }

    return true
  }
}
