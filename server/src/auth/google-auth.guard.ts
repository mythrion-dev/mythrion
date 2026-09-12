import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { isAllowedOrigin } from '../config/allowed-origins.js'

export function parseGoogleOAuthState(state?: string): { origin?: string; attributionUrl?: string } {
  if (!state) return {}
  try {
    const parsed = JSON.parse(state) as { origin?: unknown; attributionUrl?: unknown }
    return {
      origin: typeof parsed.origin === 'string' ? parsed.origin : undefined,
      attributionUrl:
        typeof parsed.attributionUrl === 'string' ? parsed.attributionUrl : undefined,
    }
  } catch {
    return { origin: state }
  }
}

/**
 * Google OAuth guard that threads the requesting frontend origin through the
 * OAuth `state` parameter.
 *
 * The OAuth exchange (authorize + token) always happens against the single
 * static GOOGLE_CALLBACK_URL on this Railway API — that URL never changes.
 * The only thing that varies per request is which frontend domain to send the
 * user back to. That origin rides along in `state` (echoed by Google), so the
 * callback can redirect to the right domain. It is validated against the
 * allowlist here so an attacker cannot inject an arbitrary redirect target.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  async getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const requestedState = req.query?.state as string | undefined
    const requestedOrigin = parseGoogleOAuthState(requestedState).origin
    if (requestedState && isAllowedOrigin(requestedOrigin)) {
      return { state: requestedState }
    }
    // Invalid/absent state: don't pass state to Google, the callback will
    // fall back to FRONTEND_URL.
    return {}
  }
}
