import { api } from './api'

export type TwoFactorPurpose = 'ENABLE' | 'DISABLE'

export interface TwoFactorChallenge {
  twoFactorId: string
}

export interface VerifyTwoFactorResponse {
  accessToken: string
  refreshToken: string
}

export interface EnableTwoFactorResponse {
  recoveryCodes: string[]
}

/** Complete a password login by verifying the emailed OTP (or a recovery code). */
export function verifyTwoFactor(
  twoFactorId: string,
  code: string,
): Promise<VerifyTwoFactorResponse> {
  return api.post<VerifyTwoFactorResponse>('/auth/verify-2fa', { twoFactorId, code })
}

/** Issue a fresh login code, invalidating the previous challenge. */
export function resendTwoFactorCode(twoFactorId: string): Promise<TwoFactorChallenge> {
  return api.post<TwoFactorChallenge>('/auth/2fa/resend', { twoFactorId })
}

/** Ask the server to email a code for enabling/disabling 2FA. */
export function sendTwoFactorCode(purpose: TwoFactorPurpose): Promise<TwoFactorChallenge> {
  return api.post<TwoFactorChallenge>('/auth/2fa/send', { purpose })
}

/** Verify the emailed code and enable/disable 2FA. Enable returns recovery codes. */
export function confirmTwoFactor(
  purpose: 'ENABLE',
  twoFactorId: string,
  code: string,
): Promise<EnableTwoFactorResponse>
export function confirmTwoFactor(
  purpose: 'DISABLE',
  twoFactorId: string,
  code: string,
): Promise<{ success: true }>
export function confirmTwoFactor(
  purpose: TwoFactorPurpose,
  twoFactorId: string,
  code: string,
): Promise<EnableTwoFactorResponse | { success: true }> {
  return api.post('/auth/2fa/confirm', { purpose, twoFactorId, code })
}
