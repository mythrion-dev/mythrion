export type AccountCreationMethod = 'form' | 'google'

interface AccountCreatedEvent {
  event: 'account_created'
  email: string
  signup_method: AccountCreationMethod
  method: AccountCreationMethod
}

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

export function trackAccountCreated(
  email: string,
  signupMethod: AccountCreationMethod,
): void {
  if (typeof window === 'undefined') return

  const event: AccountCreatedEvent = {
    event: 'account_created',
    email,
    signup_method: signupMethod,
    method: signupMethod,
  }
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(event)
}