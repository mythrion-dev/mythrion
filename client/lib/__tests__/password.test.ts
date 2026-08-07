import { describe, it, expect } from 'vitest'
import { passwordChecks, isStrongPassword, passwordStrengthScore } from '../password'

describe('password strength rules', () => {
  it('flags a compliant password as strong', () => {
    expect(isStrongPassword('Abcd1234!')).toBe(true)
    expect(passwordStrengthScore('Abcd1234!')).toBe(5)
  })

  it('rejects a short password', () => {
    expect(isStrongPassword('Ab1!')).toBe(false)
    expect(passwordChecks('Ab1!').find((c) => c.key === 'length')?.met).toBe(false)
  })

  it('requires every character class', () => {
    expect(isStrongPassword('abcdefgh')).toBe(false)
    expect(isStrongPassword('ABCDEFGH')).toBe(false)
    expect(isStrongPassword('12345678')).toBe(false)
    expect(isStrongPassword('abcdefgh1')).toBe(false)
    expect(isStrongPassword('abcdefgh!')).toBe(false)
  })

  it('counts met requirements for the strength meter', () => {
    expect(passwordStrengthScore('abcdefgh')).toBe(2) // length + lowercase
    expect(passwordStrengthScore('abc')).toBe(1) // lowercase only (length fails)
    expect(passwordStrengthScore('')).toBe(0)
  })

  it('mirrors the server-side STRONG_PASSWORD_REGEX', () => {
    // https://github.com/anthropics/claude-code — server/src/auth/password-rule.ts
    // A deliberately boundary password: exactly 8 chars, all four classes.
    expect(isStrongPassword('Aa1!aaaa')).toBe(true)
  })
})
