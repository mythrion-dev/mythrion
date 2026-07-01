import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Response } from 'express'

/**
 * Custom AuthGuard for Discord OAuth that handles the prompt=none flow.
 *
 * When prompt=none is used and the user has NOT yet authorized the app,
 * Discord redirects back with ?error=access_denied. This guard detects
 * that case and retries the authorization with prompt=consent.
 */
@Injectable()
export class DiscordAuthGuard extends AuthGuard('discord') {
  /**
   * Pass prompt: 'none' to the underlying passport-discord strategy.
   *
   * This is the CORRECT NestJS way to pass authentication options —
   * the strategy's override of authorizationParams doesn't work because
   * NestJS wraps the strategy in a proxy that doesn't forward prototype
   * method overrides. Using getAuthenticateOptions ensures the options
   * flow through passport.authenticate() → authorizationParams() correctly.
   *
   * With prompt=none, Discord silently authenticates returning users.
   * First-time users get an access_denied error, which we handle below.
   */
  getAuthenticateOptions(context: ExecutionContext): { prompt: string } {
    return { prompt: 'none' }
  }

  /**
   * Handle access_denied from prompt=none: the user hasn't authorized
   * yet (first login), so retry with prompt=consent to show the
   * authorization screen ONCE.
   *
   * On subsequent logins, prompt=none succeeds and this handler is
   * never reached — the user passes straight through to validate().
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status: any): any {
    if (err && err.code === 'access_denied') {
      const response = context.switchToHttp().getResponse<Response>()

      const discordClientId = process.env.DISCORD_CLIENT_ID ?? ''
      const redirectUri = process.env.DISCORD_CALLBACK_URL ?? ''
      const scope = ['identify', 'email'].join(' ')

      const consentUrl =
        `https://discord.com/api/oauth2/authorize` +
        `?client_id=${encodeURIComponent(discordClientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&prompt=consent`

      response.redirect(consentUrl)
      return null
    }

    if (err || !user) {
      throw err || new UnauthorizedException()
    }
    return user
  }
}
