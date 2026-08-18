import { Injectable } from '@nestjs/common'

/**
 * AdminService determines whether a user has admin privileges or early access.
 *
 * Both lists are defined server-side via the ADMIN_EMAILS and EARLY_ACCESS_EMAILS
 * environment variables (set in Railway for production, in .env for development).
 * This means:
 *
 *   - SQL injection cannot grant access (the lists are not in the database)
 *   - Route interception cannot bypass them (the checks are server-side only)
 *   - Leaked database credentials do not expose or alter the lists
 */
@Injectable()
export class AdminService {
  private readonly adminEmails: ReadonlySet<string>
  private readonly earlyAccessEmails: ReadonlySet<string>

  constructor() {
    const raw = process.env.ADMIN_EMAILS ?? ''
    this.adminEmails = new Set(
      raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )

    const earlyRaw = process.env.EARLY_ACCESS_EMAILS ?? ''
    this.earlyAccessEmails = new Set(
      earlyRaw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )
  }

  /** Returns true if the given email belongs to an admin account. */
  isAdmin(email: string): boolean {
    return this.adminEmails.has(email.toLowerCase())
  }

  /** Returns true if the given email belongs to an early-access account. */
  isEarlyAccess(email: string): boolean {
    return this.earlyAccessEmails.has(email.toLowerCase())
  }
}
