import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AdminService } from './admin.service.js'
import { SubscriptionService } from '../subscription/subscription.service.js'
import type { AuthenticatedRequest } from './AuthenticatedRequest.js'

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminService: AdminService,
    private readonly subscriptionService: SubscriptionService,
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
      throw new ForbiddenException('Authentication required to access this resource')
    }

    // Layer 1 — Admin bypass. Admin emails are defined in the ADMIN_EMAILS
    // environment variable (set in Railway for production), so this check
    // cannot be bypassed via SQL injection or database compromise.
    if (this.adminService.isAdmin(user.email)) {
      return true
    }

    // Layer 2 — Active subscription check
    const hasActive = await this.subscriptionService.hasActiveSubscription(user.sub)
    if (!hasActive) {
      throw new ForbiddenException(
        'An active subscription is required to access this resource. Please subscribe at /pricing.',
      )
    }

    return true
  }
}
