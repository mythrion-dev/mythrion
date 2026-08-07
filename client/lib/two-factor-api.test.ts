import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/lib/api'
import {
  verifyTwoFactor,
  resendTwoFactorCode,
  sendTwoFactorCode,
  confirmTwoFactor,
} from '@/lib/two-factor-api'

/* ── Mock api module ── */
vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
  API_URL: 'http://localhost:3001/api',
}))

describe('two-factor-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyTwoFactor', () => {
    it('calls api.post with /auth/verify-2fa and the challenge + code', async () => {
      const response = { accessToken: 'at', refreshToken: 'rt' }
      vi.mocked(api.post).mockResolvedValue(response)

      const result = await verifyTwoFactor('ch-1', '123456')

      expect(result).toEqual(response)
      expect(api.post).toHaveBeenCalledWith('/auth/verify-2fa', {
        twoFactorId: 'ch-1',
        code: '123456',
      })
    })

    it('propagates errors from api.post', async () => {
      const err = new Error('Invalid code')
      vi.mocked(api.post).mockRejectedValue(err)

      await expect(verifyTwoFactor('ch-1', '000000')).rejects.toThrow('Invalid code')
    })
  })

  describe('resendTwoFactorCode', () => {
    it('calls api.post with /auth/2fa/resend and returns the new challenge', async () => {
      vi.mocked(api.post).mockResolvedValue({ twoFactorId: 'ch-2' })

      const result = await resendTwoFactorCode('ch-1')

      expect(result).toEqual({ twoFactorId: 'ch-2' })
      expect(api.post).toHaveBeenCalledWith('/auth/2fa/resend', { twoFactorId: 'ch-1' })
    })

    it('propagates errors from api.post', async () => {
      const err = new Error('Challenge expired')
      vi.mocked(api.post).mockRejectedValue(err)

      await expect(resendTwoFactorCode('ch-1')).rejects.toThrow('Challenge expired')
    })
  })

  describe('sendTwoFactorCode', () => {
    it('calls api.post with /auth/2fa/send and the ENABLE purpose', async () => {
      vi.mocked(api.post).mockResolvedValue({ twoFactorId: 'ch-3' })

      const result = await sendTwoFactorCode('ENABLE')

      expect(result).toEqual({ twoFactorId: 'ch-3' })
      expect(api.post).toHaveBeenCalledWith('/auth/2fa/send', { purpose: 'ENABLE' })
    })

    it('supports the DISABLE purpose', async () => {
      vi.mocked(api.post).mockResolvedValue({ twoFactorId: 'ch-4' })

      await sendTwoFactorCode('DISABLE')

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/send', { purpose: 'DISABLE' })
    })
  })

  describe('confirmTwoFactor', () => {
    it('ENABLE: calls api.post with /auth/2fa/confirm and returns recovery codes', async () => {
      const response = { recoveryCodes: ['ABCDE12345', 'FGHIJ67890'] }
      vi.mocked(api.post).mockResolvedValue(response)

      const result = await confirmTwoFactor('ENABLE', 'ch-3', '123456')

      expect(result).toEqual(response)
      expect(api.post).toHaveBeenCalledWith('/auth/2fa/confirm', {
        purpose: 'ENABLE',
        twoFactorId: 'ch-3',
        code: '123456',
      })
    })

    it('DISABLE: calls api.post with /auth/2fa/confirm and returns success', async () => {
      vi.mocked(api.post).mockResolvedValue({ success: true })

      const result = await confirmTwoFactor('DISABLE', 'ch-4', '123456')

      expect(result).toEqual({ success: true })
      expect(api.post).toHaveBeenCalledWith('/auth/2fa/confirm', {
        purpose: 'DISABLE',
        twoFactorId: 'ch-4',
        code: '123456',
      })
    })

    it('propagates errors from api.post', async () => {
      const err = new Error('Wrong code')
      vi.mocked(api.post).mockRejectedValue(err)

      await expect(confirmTwoFactor('ENABLE', 'ch-3', '000000')).rejects.toThrow('Wrong code')
    })
  })
})
