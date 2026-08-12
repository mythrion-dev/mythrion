/**
 * Mock factory for AdminService.
 *
 * `isAdmin` / `isEarlyAccess` resolve `false` by default so existing tests keep
 * passing once a service gains the AdminService dependency. Override per-test
 * with `mockIsAdmin.mockReturnValue(true)`.
 */
export function createMockAdminService() {
  const mockIsAdmin = jest.fn().mockReturnValue(false)
  const mockIsEarlyAccess = jest.fn().mockReturnValue(false)
  return {
    isAdmin: mockIsAdmin,
    isEarlyAccess: mockIsEarlyAccess,
    mockIsAdmin,
    mockIsEarlyAccess,
  }
}
