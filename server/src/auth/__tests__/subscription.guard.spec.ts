jest.mock("../../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SubscriptionGuard } from '../subscription.guard'
import { AdminService } from '../admin.service'
import { SubscriptionService } from '../subscription/subscription.service'
import type { ExecutionContext } from '@nestjs/common'
import { createI18nServiceMock } from '../../i18n/i18n-testing.js'

function createMockContext(overrides?: {
  user?: { sub: string; email: string; role: string }
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: overrides?.user ?? { sub: 'u1', email: 'user@test.com', role: 'user' },
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
      expect(subscriptionService.hasActiveSubscription).not.toHaveBeenCalled()
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
      expect(subscriptionService.hasActiveSubscription).not.toHaveBeenCalled()
    })

    it('blocks early-access users from the subscription check only when not in the list', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(false)
      adminService.isEarlyAccess.mockReturnValue(false)
      subscriptionService.hasActiveSubscription.mockResolvedValue(false)

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
      subscriptionService.hasActiveSubscription.mockResolvedValue(true)

      const result = await guard.canActivate(
        createMockContext({
          user: { sub: 'u1', email: 'user@test.com', role: 'user' },
        }),
      )

      expect(result).toBe(true)
      expect(subscriptionService.hasActiveSubscription).toHaveBeenCalledWith('u1')
    })

    it('throws ForbiddenException when user has no active subscription', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.hasActiveSubscription.mockResolvedValue(false)

      await expect(
        guard.canActivate(
          createMockContext({
            user: { sub: 'u1', email: 'user@test.com', role: 'user' },
          }),
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('includes pricing redirect hint in ForbiddenException message', async () => {
      reflector.getAllAndOverride.mockReturnValue(false)
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.hasActiveSubscription.mockResolvedValue(false)

      try {
        await guard.canActivate(
          createMockContext({
            user: { sub: 'u1', email: 'user@test.com', role: 'user' },
          }),
        )
        expect(true).toBe(false) // should not reach here
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException)
        expect((err as ForbiddenException).message).toMatch(/\/pricing/)
      }
    })
  })
})
