jest.mock("../../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SubscriptionGuard } from '../subscription.guard'
import { AdminService } from '../admin.service'
import { SubscriptionService } from '../../subscription/subscription.service'
import type { ExecutionContext } from '@nestjs/common'
import { createI18nServiceMock } from '../../i18n/i18n-testing.js'

function createMockContext(overrides?: {
  user?: { sub: string; email: string; role: string }
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        // Respect an explicit `user: undefined` override (the "no user" case)
        // instead of silently falling back to the default via nullish coalescing.
        user:
          overrides && 'user' in overrides
            ? overrides.user
            : { sub: 'u1', email: 'user@test.com', role: 'user' },
      }),
      getResponse: () => ({}),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext
}

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard
  let reflector: jest.Mocked<Reflector>
  let adminService: jest.Mocked<AdminService>
  let subscriptionService: jest.Mocked<SubscriptionService>

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>

    adminService = {
      isAdmin: jest.fn(),
      isEarlyAccess: jest.fn(),
    } as unknown as jest.Mocked<AdminService>

    subscriptionService = {
      hasActiveSubscription: jest.fn(),
      getSubscriptionAccessReason: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionService>

    guard = new SubscriptionGuard(
      reflector,
      adminService,
      subscriptionService,
      createI18nServiceMock(),
    )
  })

  describe('@SkipSubscriptionCheck decorator', () => {
    it('allows access when the handler has SkipSubscriptionCheck metadata', async () => {
      reflector.getAllAndOverride.mockReturnValue(true)

      const result = await guard.canActivate(createMockContext())

      expect(result).toBe(true)
    })

    it('allows access when the class has SkipSubscriptionCheck metadata', async () => {
      reflector.getAllAndOverride.mockReturnValue(true)

      const result = await guard.canActivate(createMockContext())

      expect(result).toBe(true)
    })
  })

  describe('authentication requirement', () => {
    it('throws ForbiddenException when no user on request', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)

      await expect(
        guard.canActivate(createMockContext({ user: undefined as any })),
      ).rejects.toThrow(ForbiddenException)
    })

    it('throws ForbiddenException when user has no email', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)

      await expect(
        guard.canActivate(
          createMockContext({
            user: { sub: 'u1', email: '', role: 'user' },
          }),
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('admin bypass', () => {
    it('allows admin users without checking subscription', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(true)

      const result = await guard.canActivate(
        createMockContext({
          user: { sub: 'admin-1', email: 'admin@mythrion.com', role: 'admin' },
        }),
      )

      expect(result).toBe(true)
      expect(adminService.isAdmin).toHaveBeenCalledWith('admin@mythrion.com')
      expect(subscriptionService.getSubscriptionAccessReason).not.toHaveBeenCalled()
    })

    it('allows early-access users without checking subscription', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(false)
      adminService.isEarlyAccess.mockReturnValue(true)

      const result = await guard.canActivate(
        createMockContext({
          user: { sub: 'early-1', email: 'early@mythrion.com', role: 'early_access' },
        }),
      )

      expect(result).toBe(true)
      expect(adminService.isEarlyAccess).toHaveBeenCalledWith('early@mythrion.com')
      expect(subscriptionService.getSubscriptionAccessReason).not.toHaveBeenCalled()
    })

    it('blocks early-access users from the subscription check only when not in the list', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(false)
      adminService.isEarlyAccess.mockReturnValue(false)
      subscriptionService.getSubscriptionAccessReason.mockResolvedValue('none')

      await expect(
        guard.canActivate(
          createMockContext({
            user: { sub: 'u1', email: 'user@test.com', role: 'user' },
          }),
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('subscription check', () => {
    it('allows access when user has an active subscription', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getSubscriptionAccessReason.mockResolvedValue('active')

      const result = await guard.canActivate(
        createMockContext({
          user: { sub: 'u1', email: 'user@test.com', role: 'user' },
        }),
      )

      expect(result).toBe(true)
      expect(subscriptionService.getSubscriptionAccessReason).toHaveBeenCalledWith('u1')
    })

    it('throws activeSubscriptionRequired when user has no subscription at all', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getSubscriptionAccessReason.mockResolvedValue('none')

      try {
        await guard.canActivate(
          createMockContext({
            user: { sub: 'u1', email: 'user@test.com', role: 'user' },
          }),
        )
        throw new Error('should not reach here')
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException)
        expect((err as ForbiddenException).message).toBe(
          'You need an active subscription to use this feature.',
        )
      }
    })

    it('throws subscriptionExpired when the subscription has expired', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getSubscriptionAccessReason.mockResolvedValue('expired')

      try {
        await guard.canActivate(
          createMockContext({
            user: { sub: 'u1', email: 'user@test.com', role: 'user' },
          }),
        )
        throw new Error('should not reach here')
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException)
        expect((err as ForbiddenException).message).toBe(
          'Your subscription has expired. Renew your subscription to continue.',
        )
      }
    })
  })
})
