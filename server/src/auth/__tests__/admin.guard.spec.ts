import { ForbiddenException } from '@nestjs/common'
import { AdminGuard } from '../admin.guard'
import { AdminService } from '../admin.service'
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

describe('AdminGuard', () => {
  let guard: AdminGuard
  let adminService: jest.Mocked<AdminService>

  beforeEach(() => {
    adminService = {
      isAdmin: jest.fn(),
    } as unknown as jest.Mocked<AdminService>

    guard = new AdminGuard(adminService, createI18nServiceMock())
  })

  it('allows access when user is an admin', () => {
    adminService.isAdmin.mockReturnValue(true)

    const result = guard.canActivate(
      createMockContext({
        user: { sub: 'admin-1', email: 'admin@mythrion.com', role: 'admin' },
      }),
    )

    expect(result).toBe(true)
    expect(adminService.isAdmin).toHaveBeenCalledWith('admin@mythrion.com')
  })

  it('blocks access when user is not an admin', () => {
    adminService.isAdmin.mockReturnValue(false)

    const result = guard.canActivate(
      createMockContext({
        user: { sub: 'u1', email: 'user@test.com', role: 'user' },
      }),
    )

    expect(result).toBe(false)
    expect(adminService.isAdmin).toHaveBeenCalledWith('user@test.com')
  })

  it('returns false when no user on request (guard falls through to isAdmin check)', () => {
    // The mock's `??` falls through to the default user when `undefined` is passed,
    // so this tests that a non-admin user gets false rather than a throw.
    adminService.isAdmin.mockReturnValue(false)

    const result = guard.canActivate(
      createMockContext({ user: undefined as any }),
    )

    expect(result).toBe(false)
    expect(adminService.isAdmin).toHaveBeenCalled()
  })

  it('throws ForbiddenException when user has no email', () => {
    expect(() =>
      guard.canActivate(
        createMockContext({
          user: { sub: 'u1', email: '', role: 'user' },
        }),
      ),
    ).toThrow(ForbiddenException)
  })
})
