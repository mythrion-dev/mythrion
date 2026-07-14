import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { PrismaService } from '../prisma.service.js'
import { GoogleService } from './google.service.js'
import { GoogleStrategy } from './google.strategy.js'
import { TokenService } from './token.service.js'
import { RateLimitGuard } from './rate-limit.guard.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    PrismaService,
    GoogleService,
    GoogleStrategy,
    TokenService,
    RateLimitGuard,
  ],
  exports: [JwtAuthGuard, JwtModule, AuthService, GoogleService, TokenService, RateLimitGuard],
})
export class AuthModule {}