import { SetMetadata } from '@nestjs/common'

/**
 * Decorator that marks a route handler as exempt from the subscription check.
 * Use this on public endpoints (login, register, pricing, webhooks, etc.)
 * and on subscription-related endpoints (creating a subscription, checking
 * status) that must be accessible before a user has an active subscription.
 */
export const SkipSubscriptionCheck = () => SetMetadata('skipSubscriptionCheck', true)
