jest.mock("../../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test } from '@nestjs/testing'
import { PermissionService } from '../permission.service'
import { AdminService } from '../admin.service'
import { SubscriptionService } from '../../subscription/subscription.service'
import { PrismaService } from '../../prisma.service'
import { createMockPrismaService } from '../../__mocks__/prisma-service.mock'

describe('PermissionService', () => {
  let service: PermissionService
  let adminService: { isAdmin: jest.Mock; isEarlyAccess: jest.Mock }
  let subscriptionService: {
    hasActiveSubscription: jest.Mock
    getMySubscription: jest.Mock
  }
  let prisma: ReturnType<typeof createMockPrismaService>

  const activeSub = {
    id: 'sub-1',
    plan: { slug: 'monthly', name: 'Monthly', price: 12000 },
    status: 'ACTIVE',
    hasActiveSubscription: true,
    pgSubscriptionId: 'pg-sub-1',
    graceEndsAt: null,
    currentPeriodStart: new Date('2025-01-01'),
    currentPeriodEnd: new Date('2025-02-01'),
    cancelledAt: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date('2025-01-01'),
    invoices: [],
  }

  const graceSub = {
    ...activeSub,
    status: 'GRACE',
    hasActiveSubscription: true,
    graceEndsAt: new Date('2025-01-15'),
    currentPeriodEnd: new Date('2025-01-10'),
  }

  beforeEach(async () => {
    adminService = {
      isAdmin: jest.fn().mockReturnValue(false),
      isEarlyAccess: jest.fn().mockReturnValue(false),
    }
    subscriptionService = {
      hasActiveSubscription: jest.fn().mockResolvedValue(false),
      getMySubscription: jest.fn().mockResolvedValue(null),
    }
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    const module = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: AdminService, useValue: adminService },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<PermissionService>(PermissionService)
  })

  // ─── role / early access ────────────────────────────────────────────

  it('returns role user with no entitlements for a plain user without subscription', async () => {
    const result = await service.getPermissions('user-1', 'user@test.com')

    expect(result.role).toBe('user')
    expect(result.earlyAccess).toBe(false)
    expect(result.entitlements).toEqual({
      hasActiveSubscription: false,
      canUseSubscriptionFeatures: false,
    })
    expect(result.subscription).toEqual({
      plan: null,
      status: null,
      expiresAt: null,
    })
    expect(result.limits).toEqual({ maxCampaigns: null, maxTemplates: null })
    expect(prisma.subscriptionPlan.findUnique).not.toHaveBeenCalled()
  })

  it('returns role admin for a user on the admin list, regardless of subscription', async () => {
    adminService.isAdmin.mockReturnValue(true)

    const result = await service.getPermissions('admin-1', 'admin@test.com')

    expect(result.role).toBe('admin')
    expect(result.entitlements.hasActiveSubscription).toBe(false)
    expect(result.entitlements.canUseSubscriptionFeatures).toBe(true)
  })

  it('returns role early_access with earlyAccess true for an early-access user', async () => {
    adminService.isEarlyAccess.mockReturnValue(true)

    const result = await service.getPermissions('ea-1', 'ea@test.com')

    expect(result.role).toBe('early_access')
    expect(result.earlyAccess).toBe(true)
    expect(result.entitlements.canUseSubscriptionFeatures).toBe(true)
  })

  it('prioritizes admin over early access when both lists contain the user', async () => {
    adminService.isAdmin.mockReturnValue(true)
    adminService.isEarlyAccess.mockReturnValue(true)

    const result = await service.getPermissions('a-1', 'both@test.com')

    expect(result.role).toBe('admin')
    expect(result.earlyAccess).toBe(true)
  })

  it('lowercases emails before checking admin/early-access lists', async () => {
    adminService.isAdmin.mockReturnValue(true)

    await service.getPermissions('u-1', 'Admin@Test.com')

    expect(adminService.isAdmin).toHaveBeenCalledWith('Admin@Test.com')
  })

  // ─── subscription / entitlement ─────────────────────────────────────

  it('reports an ACTIVE subscription with plan and expiresAt from currentPeriodEnd', async () => {
    subscriptionService.getMySubscription.mockResolvedValue(activeSub)

    const result = await service.getPermissions('user-1', 'user@test.com')

    expect(result.entitlements.hasActiveSubscription).toBe(true)
    expect(result.entitlements.canUseSubscriptionFeatures).toBe(true)
    expect(result.subscription.plan).toEqual({ slug: 'monthly', name: 'Monthly', price: 12000 })
    expect(result.subscription.status).toBe('ACTIVE')
    expect(result.subscription.expiresAt).toBe('2025-02-01T00:00:00.000Z')
  })

  it('uses graceEndsAt as expiresAt for a GRACE subscription', async () => {
    subscriptionService.getMySubscription.mockResolvedValue(graceSub)

    const result = await service.getPermissions('user-1', 'user@test.com')

    expect(result.subscription.status).toBe('GRACE')
    expect(result.subscription.expiresAt).toBe('2025-01-15T00:00:00.000Z')
  })

  it('reports hasActiveSubscription false when the row is ACTIVE but the period has lapsed', async () => {
    subscriptionService.getMySubscription.mockResolvedValue({
      ...activeSub,
      hasActiveSubscription: false,
    })

    const result = await service.getPermissions('user-1', 'user@test.com')

    expect(result.entitlements.hasActiveSubscription).toBe(false)
    expect(result.entitlements.canUseSubscriptionFeatures).toBe(false)
    // The row still exists, so its metadata is surfaced even though entitlement is gone.
    expect(result.subscription.status).toBe('ACTIVE')
  })

  it('surfaces EXPIRED subscription status with an expiresAt in the past', async () => {
    subscriptionService.getMySubscription.mockResolvedValue({
      ...activeSub,
      status: 'EXPIRED',
      hasActiveSubscription: false,
      currentPeriodEnd: new Date('2025-01-05'),
    })

    const result = await service.getPermissions('user-1', 'user@test.com')

    expect(result.subscription.status).toBe('EXPIRED')
    expect(result.subscription.expiresAt).toBe('2025-01-05T00:00:00.000Z')
  })

  // ─── limits ─────────────────────────────────────────────────────────

  it('loads plan limits fresh from the plan row', async () => {
    subscriptionService.getMySubscription.mockResolvedValue(activeSub)
    prisma.subscriptionPlan.findUnique.mockResolvedValue({
      limits: { maxCampaigns: 3, maxTemplates: 10 },
    })

    const result = await service.getPermissions('user-1', 'user@test.com')

    expect(result.limits).toEqual({ maxCampaigns: 3, maxTemplates: 10 })
    expect(prisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
      where: { slug: 'monthly' },
      select: { limits: true },
    })
  })

  it('treats null plan limits as unlimited (null caps)', async () => {
    subscriptionService.getMySubscription.mockResolvedValue(activeSub)
    prisma.subscriptionPlan.findUnique.mockResolvedValue({ limits: null })

    const result = await service.getPermissions('user-1', 'user@test.com')

    expect(result.limits).toEqual({ maxCampaigns: null, maxTemplates: null })
  })

  it('does not query limits when the user has no subscription', async () => {
    subscriptionService.getMySubscription.mockResolvedValue(null)

    await service.getPermissions('user-1', 'user@test.com')

    expect(prisma.subscriptionPlan.findUnique).not.toHaveBeenCalled()
  })
})
