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
   * Override handleRequest to catch access_denied errors from the
   * prompt=none attempt and retry with prompt=consent.
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status: any): any {
    // If we got access_denied, the user hasn't authorized yet.
    // We need to retry with prompt=consent to show them the authorization screen.
    if (err && err.code === 'access_denied') {
      const request = context.switchToHttp().getRequest()
      const response = context.switchToHttp().getResponse<Response>()

      const discordClientId = process.env.DISCORD_CLIENT_ID ?? ''
      const callbackURL = process.env.DISCORD_CALLBACK_URL ?? ''
      const scopes = ['identify', 'email'].join(' ')

      const consentUrl =
        `https://discord.com/api/oauth2/authorize` +
        `?client_id=${encodeURIComponent(discordClientId)}` +
        `&redirect_uri=${encodeURIComponent(callbackURL)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&prompt=consent`

      response.redirect(consentUrl)
      return null // Stop processing
    }

    // Default handling for other cases
    if (err || !user) {
      throw err || new UnauthorizedException()
    }
    return user
  }
}