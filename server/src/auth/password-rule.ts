/**
 * Shared server-side password policy. The client strength meter mirrors these
 * rules — keep them in sync when either side changes.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function checkPasswordStrength(password: string): boolean {
  return STRONG_PASSWORD_REGEX.test(password);
}
