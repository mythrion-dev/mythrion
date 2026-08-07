export interface PasswordCheck {
  key: 'length' | 'lowercase' | 'uppercase' | 'digit' | 'special'
  met: boolean
}

// Mirrors STRONG_PASSWORD_REGEX on the server (server/src/auth/password-rule.ts):
// at least 8 chars, one lowercase, one uppercase, one digit, one special char.
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { key: 'length', met: password.length >= 8 },
    { key: 'lowercase', met: /[a-z]/.test(password) },
    { key: 'uppercase', met: /[A-Z]/.test(password) },
    { key: 'digit', met: /\d/.test(password) },
    { key: 'special', met: /[^A-Za-z0-9]/.test(password) },
  ]
}

export function isStrongPassword(password: string): boolean {
  return passwordChecks(password).every((check) => check.met)
}

export function passwordStrengthScore(password: string): number {
  return passwordChecks(password).filter((check) => check.met).length
}
