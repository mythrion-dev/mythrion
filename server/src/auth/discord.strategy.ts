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

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
  ) {
    return this.discordService.validateOAuthLogin(profile)
  }
}