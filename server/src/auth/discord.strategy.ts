import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-discord'
import { DiscordService } from './discord.service.js'

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(private readonly discordService: DiscordService) {
    super({
      clientID: process.env.DISCORD_CLIENT_ID ?? '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
      callbackURL: process.env.DISCORD_CALLBACK_URL ?? '',
      scope: ['identify', 'email'],
      passReqToCallback: false,
    })
  }

  /**
   * Override authorizationParams to prevent Discord from showing
   * the authorization screen on every login.
   *
   * Discord's default behavior when no prompt= parameter is sent
   * is to ALWAYS show the authorization screen.
   *
   * With prompt: 'none', Discord silently authenticates if the user
   * has already authorized the app. If they haven't, Discord returns
   * an error (access_denied) which we handle in the callback.
   */
  override authorizationParams(options: any): Record<string, string> {
    const params: Record<string, string> = {}
    const prompt = options?.prompt || 'none'
    params.prompt = prompt
    return params
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
  ) {
    return this.discordService.validateOAuthLogin(profile)
  }
}
