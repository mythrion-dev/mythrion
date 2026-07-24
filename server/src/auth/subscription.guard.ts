import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { AdminService } from './admin.service.js'
import type { AuthenticatedRequest } from './AuthenticatedRequest.js'

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly adminService: AdminService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request.user

    if (!user?.email) {
      throw new UnauthorizedException('Authentication required')
    }

    // Layer 1 — Admin bypass. Admin emails are defined in the ADMIN_EMAILS
    // environment variable (set in Railway for production), so this check
    // cannot be bypassed via SQL injection or database compromise.
    if (this.adminService.isAdmin(user.email)) {
      return true
    }

    // Layer 2 — Subscription check.
    // TODO: Once the payment system is implemented, replace this with a real
    //       subscription lookup. Example:
    //         return this.subscriptionService.hasActiveSubscription(user.sub)
    //       For now, all non-admin users are allowed through so development
    //       is unblocked until payment is wired up.
    return true
  }
}
