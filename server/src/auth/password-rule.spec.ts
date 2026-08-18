import {
  PASSWORD_MIN_LENGTH,
  STRONG_PASSWORD_REGEX,
  checkPasswordStrength,
} from './password-rule.js'

describe('password-rule', () => {
  it('exports PASSWORD_MIN_LENGTH = 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })

  it('exports a STRONG_PASSWORD_REGEX with the four-character-class requirements', () => {
    expect(STRONG_PASSWORD_REGEX.source).toContain('(?=.*[a-z])')
    expect(STRONG_PASSWORD_REGEX.source).toContain('(?=.*[A-Z])')
    expect(STRONG_PASSWORD_REGEX.source).toContain('(?=.*\\d)')
    expect(STRONG_PASSWORD_REGEX.source).toContain('(?=.*[^A-Za-z0-9])')
  })

  describe('checkPasswordStrength', () => {
    it.each([
      // [description, password, expected]
      ['a password shorter than 8 chars', 'Ab1!def', false],
      ['a password missing a lowercase letter', 'ABCDEF1!', false],
      ['a password missing an uppercase letter', 'abcdef1!', false],
      ['a password missing a digit', 'Abcdefg!', false],
      ['a password missing a special character', 'Abcdefg1', false],
      ['an empty password', '', false],
      ['an all-special password with no digit', '!@#$%^&*aA', false],
      ['a strong 8-char password', 'Ab1!efgh', true],
      ['a strong longer password', 'Str0ng!Passw0rd', true],
      ['a password with a digit, special, upper, lower (mixed order)', 'p4sS!word', true],
    ])('returns %s for %j', (_desc, password, expected) => {
      expect(checkPasswordStrength(password)).toBe(expected)
    })

    it('is consistent with PASSWORD_MIN_LENGTH (8 chars is the boundary)', () => {
      expect('Ab1!efgh').toHaveLength(PASSWORD_MIN_LENGTH)
      expect(checkPasswordStrength('Ab1!efgh')).toBe(true)
      expect('Ab1!efg').toHaveLength(PASSWORD_MIN_LENGTH - 1)
      expect(checkPasswordStrength('Ab1!efg')).toBe(false)
    })
  })
})
