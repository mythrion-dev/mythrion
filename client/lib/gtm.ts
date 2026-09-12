export type AccountCreationMethod = 'form' | 'google'

const PENDING_ACCOUNT_CREATED_KEY = 'mythrion:pending-account-created'

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

export function queueAccountCreated(
  email: string,
  signupMethod: AccountCreationMethod,
): void {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    PENDING_ACCOUNT_CREATED_KEY,
    JSON.stringify({ email, signupMethod }),
  )
}

export function flushQueuedAccountCreated(): void {
  if (typeof window === 'undefined') return

  const rawEvent = window.sessionStorage.getItem(PENDING_ACCOUNT_CREATED_KEY)
  if (!rawEvent) return

  window.sessionStorage.removeItem(PENDING_ACCOUNT_CREATED_KEY)

  try {
    const pendingEvent = JSON.parse(rawEvent) as {
      email?: unknown
      signupMethod?: unknown
    }
    if (
      typeof pendingEvent.email === 'string' &&
      (pendingEvent.signupMethod === 'form' || pendingEvent.signupMethod === 'google')
    ) {
      trackAccountCreated(pendingEvent.email, pendingEvent.signupMethod)
    }
  } catch {
    // Ignore malformed tracking data and keep authentication unaffected.
  }
}