import { Injectable } from '@nestjs/common'

/**
 * AdminService determines whether a user has admin privileges.
 *
 * The admin list is defined server-side via the ADMIN_EMAILS environment variable
 * (set in Railway for production, in .env for development). This means:
 *
 *   - SQL injection cannot grant admin access (the list is not in the database)
 *   - Route interception cannot bypass it (the check is server-side only)
 *   - Leaked database credentials do not expose or alter the admin list
 */
@Injectable()
export class AdminService {
  private readonly adminEmails: ReadonlySet<string>

  constructor() {
    const raw = process.env.ADMIN_EMAILS ?? ''
    this.adminEmails = new Set(
      raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )
  }

  /** Returns true if the given email belongs to an admin account. */
  isAdmin(email: string): boolean {
    return this.adminEmails.has(email.toLowerCase())
  }
}
