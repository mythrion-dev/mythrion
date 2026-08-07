import { api } from './api'

interface SuccessResponse {
  success: true
}

export async function verifyEmail(token: string): Promise<SuccessResponse> {
  return api.post<SuccessResponse>('/auth/verify-email', { token })
}

export async function resendVerification(
  email: string,
): Promise<SuccessResponse> {
  return api.post<SuccessResponse>('/auth/resend-verification', { email })
}

export async function changeEmail(email: string): Promise<SuccessResponse> {
  return api.post<SuccessResponse>('/auth/change-email', { email })
}

export async function forgotPassword(email: string): Promise<SuccessResponse> {
  return api.post<SuccessResponse>('/auth/forgot-password', { email })
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<SuccessResponse> {
  return api.post<SuccessResponse>('/auth/reset-password', { token, password })
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  logoutOtherDevices?: boolean
  currentRefreshToken?: string
}

export async function changePassword(
  body: ChangePasswordRequest,
): Promise<SuccessResponse> {
  return api.post<SuccessResponse>('/auth/change-password', body)
}
