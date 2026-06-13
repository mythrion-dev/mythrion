import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-google-oauth20'
import { GoogleService } from './google.service.js'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly googleService: GoogleService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '',
      scope: ['profile', 'email'],
      passReqToCallback: false,
    })
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
  ) {
    return this.googleService.validateOAuthLogin(profile)
  }
}