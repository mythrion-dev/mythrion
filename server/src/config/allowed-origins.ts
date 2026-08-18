/**
 * Single source of truth for which frontend origins the API trusts.
 *
 * The API lives on one Railway URL; the frontend is served from multiple
 * domains (Vercel + custom domains). Every origin the frontend can be reached
 * from must be allow-listed here so that:
 *
 *   - CORS accepts requests coming from that domain, and
 *   - the Google OAuth callback redirects the user back to that domain (via
 *     the `state` parameter) instead of a fixed FRONTEND_URL — validated here
 *     to prevent open redirects.
 *
 * Env vars:
 *   - `ALLOWED_ORIGINS` — comma-separated list of frontend origins. This is
 *     the var that grows when a new domain points at the frontend.
 *   - `FRONTEND_URL` — always included too; kept as the default/fallback
 *     origin (used by invites and when no `state` is present).
 *
 * Local dev origins are always allowed.
 */

/** Normalize a raw origin string to its canonical form (protocol + host). */
export function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null
  let origin = raw.trim()
  if (!origin) return null
  if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
    origin = `https://${origin}`
  }
  try {
    return new URL(origin).origin
  } catch {
    return null
  }
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>()

  // Growth point for new frontend domains.
  for (const raw of (process.env.ALLOWED_ORIGINS ?? '').split(',')) {
    const origin = normalizeOrigin(raw)
    if (origin) origins.add(origin)
  }

  // Default/fallback origin always contributes.
  const fallback = normalizeOrigin(process.env.FRONTEND_URL)
  if (fallback) origins.add(fallback)

  // Local dev always allowed.
  origins.add('http://localhost:3000')
  origins.add('http://localhost:3001')

  return [...origins]
}

export function isAllowedOrigin(origin: string | undefined | null): boolean {
  const normalized = normalizeOrigin(origin)
  if (!normalized) return false
  return getAllowedOrigins().includes(normalized)
}
