import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-google-oauth20'
import { GoogleService } from './google.service.js'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly googleService: GoogleService) {
    super({
      clientID: 'GOOGLE_CLIENTE_ID',
      clientSecret: 'GOOGLE_CALLBACK_URL',
      callbackURL: 'GOOGLE_CLIENTE_SECRET',
      scope: ['profile', 'email'],
      passReqToCallback: false,
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return this.googleService.validateOAuthLogin(profile)
  }
}