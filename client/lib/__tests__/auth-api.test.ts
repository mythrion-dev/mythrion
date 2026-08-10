import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/lib/api'
import {
  verifyEmail,
  resendVerification,
  changeEmail,
  forgotPassword,
  resetPassword,
  changePassword,
} from '@/lib/auth-api'

/* ── Mock api module ── */
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  API_URL: 'http://localhost:3001/api',
}))

describe('auth-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifyEmail posts the token to /auth/verify-email', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true })

    const result = await verifyEmail('tok-1')

    expect(result).toEqual({ success: true })
    expect(api.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'tok-1' })
  })

  it('resendVerification posts the email to /auth/resend-verification', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true })

    const result = await resendVerification('alice@example.com')

    expect(result).toEqual({ success: true })
    expect(api.post).toHaveBeenCalledWith('/auth/resend-verification', {
      email: 'alice@example.com',
    })
  })

  it('changeEmail posts the email to /auth/change-email', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true })

    const result = await changeEmail('new@example.com')

    expect(result).toEqual({ success: true })
    expect(api.post).toHaveBeenCalledWith('/auth/change-email', {
      email: 'new@example.com',
    })
  })

  it('forgotPassword posts the email to /auth/forgot-password', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true })

    const result = await forgotPassword('alice@example.com')

    expect(result).toEqual({ success: true })
    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'alice@example.com',
    })
  })

  it('resetPassword posts the token and password to /auth/reset-password', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true })

    const result = await resetPassword('tok-1', 'newpass123')

    expect(result).toEqual({ success: true })
    expect(api.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'tok-1',
      password: 'newpass123',
    })
  })

  it('changePassword posts the body to /auth/change-password', async () => {
    const body = {
      currentPassword: 'oldpass',
      newPassword: 'newpass',
      logoutOtherDevices: true,
    }
    vi.mocked(api.post).mockResolvedValue({ success: true })

    const result = await changePassword(body)

    expect(result).toEqual({ success: true })
    expect(api.post).toHaveBeenCalledWith('/auth/change-password', body)
  })
})
