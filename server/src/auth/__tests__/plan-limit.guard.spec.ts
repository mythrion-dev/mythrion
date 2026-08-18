jest.mock("../../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PlanLimitGuard } from '../plan-limit.guard'
import { AdminService } from '../admin.service'
import { SubscriptionService } from '../../subscription/subscription.service'
import { PrismaService } from '../../prisma.service'
import { createMockPrismaService } from '../../__mocks__/prisma-service.mock'
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

const activeSub = {
  id: 'sub-1',
  plan: { slug: 'monthly', name: 'Monthly', price: 12000 },
  status: 'ACTIVE',
  pgSubscriptionId: 'pg-sub-1',
  graceEndsAt: null,
  currentPeriodStart: new Date('2025-01-01'),
  currentPeriodEnd: new Date('2025-02-01'),
  cancelledAt: null,
  cancelAtPeriodEnd: false,
  createdAt: new Date('2025-01-01'),
  invoices: [],
}

describe('PlanLimitGuard', () => {
  let guard: PlanLimitGuard
  let reflector: jest.Mocked<Reflector>
  let adminService: jest.Mocked<AdminService>
  let subscriptionService: jest.Mocked<SubscriptionService>
  let prisma: ReturnType<typeof createMockPrismaService>

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
      getMySubscription: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionService>

    prisma = createMockPrismaService()

    guard = new PlanLimitGuard(
      reflector,
      adminService,
      subscriptionService,
      prisma as unknown as PrismaService,
      createI18nServiceMock(),
    )
  })

  describe('metadata', () => {
    it('allows access when no @PlanLimit() metadata is present', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined)

      const result = await guard.canActivate(createMockContext())

      expect(result).toBe(true)
      expect(subscriptionService.getMySubscription).not.toHaveBeenCalled()
    })
  })

  describe('authentication requirement', () => {
    it('throws ForbiddenException when no user on request', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      const context = {
        switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException)
    })

    it('throws ForbiddenException when user has no email', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')

      await expect(
        guard.canActivate(
          createMockContext({
            user: { sub: 'u1', email: '', role: 'user' },
          }),
        ),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('admin/early-access bypass', () => {
    it('allows admin users without checking subscription or limits', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      adminService.isAdmin.mockReturnValue(true)

      const result = await guard.canActivate(
        createMockContext({
          user: { sub: 'admin-1', email: 'admin@mythrion.com', role: 'admin' },
        }),
      )

      expect(result).toBe(true)
      expect(subscriptionService.getMySubscription).not.toHaveBeenCalled()
      expect(prisma.adventure.count).not.toHaveBeenCalled()
    })

    it('allows early-access users without checking subscription or limits', async () => {
      reflector.getAllAndOverride.mockReturnValue('template')
      adminService.isAdmin.mockReturnValue(false)
      adminService.isEarlyAccess.mockReturnValue(true)

      const result = await guard.canActivate(
        createMockContext({
          user: { sub: 'early-1', email: 'early@mythrion.com', role: 'early_access' },
        }),
      )

      expect(result).toBe(true)
      expect(subscriptionService.getMySubscription).not.toHaveBeenCalled()
      expect(prisma.template.count).not.toHaveBeenCalled()
    })
  })

  describe('unlimited plans', () => {
    it('allows a user with no subscription (no plan => no caps)', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(null)

      const result = await guard.canActivate(createMockContext())

      expect(result).toBe(true)
      expect(prisma.subscriptionPlan.findUnique).not.toHaveBeenCalled()
    })

    it('allows a plan whose row has no limits (default unlimited)', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({ limits: null })

      const result = await guard.canActivate(createMockContext())

      expect(result).toBe(true)
      expect(prisma.adventure.count).not.toHaveBeenCalled()
    })

    it('allows a campaign create when only a template cap is set', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        limits: { maxTemplates: 10 },
      })

      const result = await guard.canActivate(createMockContext())

      expect(result).toBe(true)
      expect(prisma.adventure.count).not.toHaveBeenCalled()
    })
  })

  describe('campaign cap enforcement', () => {
    it('allows create when owned count is below the cap', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        limits: { maxCampaigns: 3, maxTemplates: 10 },
      })
      prisma.adventure.count.mockResolvedValue(2)

      const result = await guard.canActivate(createMockContext())

      expect(result).toBe(true)
      expect(prisma.adventure.count).toHaveBeenCalledWith({ where: { ownerId: 'u1' } })
    })

    it('throws campaignLimitReached when owned count meets the cap', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        limits: { maxCampaigns: 3, maxTemplates: 10 },
      })
      prisma.adventure.count.mockResolvedValue(3)

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('reports the campaign-limit message (not a generic subscription error)', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        limits: { maxCampaigns: 1, maxTemplates: 10 },
      })
      prisma.adventure.count.mockResolvedValue(1)

      try {
        await guard.canActivate(createMockContext())
        throw new Error('should not reach here')
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException)
        expect((err as ForbiddenException).message).toMatch(/campaign limit/)
      }
    })
  })

  describe('template cap enforcement', () => {
    it('allows create when owned count is below the cap', async () => {
      reflector.getAllAndOverride.mockReturnValue('template')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        limits: { maxCampaigns: 3, maxTemplates: 10 },
      })
      prisma.template.count.mockResolvedValue(9)

      const result = await guard.canActivate(createMockContext())

      expect(result).toBe(true)
      expect(prisma.template.count).toHaveBeenCalledWith({ where: { ownerId: 'u1' } })
    })

    it('throws templateLimitReached when owned count meets the cap', async () => {
      reflector.getAllAndOverride.mockReturnValue('template')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        limits: { maxCampaigns: 3, maxTemplates: 10 },
      })
      prisma.template.count.mockResolvedValue(10)

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('reports the template-limit message (not a generic subscription error)', async () => {
      reflector.getAllAndOverride.mockReturnValue('template')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        limits: { maxCampaigns: 3, maxTemplates: 1 },
      })
      prisma.template.count.mockResolvedValue(1)

      try {
        await guard.canActivate(createMockContext())
        throw new Error('should not reach here')
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException)
        expect((err as ForbiddenException).message).toMatch(/template limit/)
      }
    })
  })

  describe('reads limits fresh from the plan row', () => {
    it('never reads limits from cache (stale Redis cannot grant or deny)', async () => {
      reflector.getAllAndOverride.mockReturnValue('campaign')
      adminService.isAdmin.mockReturnValue(false)
      subscriptionService.getMySubscription.mockResolvedValue(activeSub)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        limits: { maxCampaigns: 0, maxTemplates: 0 },
      })
      prisma.adventure.count.mockResolvedValue(0)

      await expect(guard.canActivate(createMockContext())).rejects.toThrow(
        ForbiddenException,
      )
      expect(prisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
        where: { slug: 'monthly' },
        select: { limits: true },
      })
    })
  })
})
