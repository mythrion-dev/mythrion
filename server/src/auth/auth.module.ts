import { Global, Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { LanguageService } from './language.service.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { PrismaService } from '../prisma.service.js'
import { GoogleService } from './google.service.js'
import { GoogleStrategy } from './google.strategy.js'
import { GoogleAuthGuard } from './google-auth.guard.js'
import { TokenService } from './token.service.js'
import { RateLimitGuard } from './rate-limit.guard.js'
import { AdminService } from './admin.service.js'
import { SubscriptionGuard } from './subscription.guard.js'
import { AdminGuard } from './admin.guard.js'
import { SubscriptionModule } from '../subscription/subscription.module.js'
import { EmailModule } from '../email/email.module.js'
import { TwoFactorService } from './two-factor.service.js'

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
    PassportModule,
    forwardRef(() => SubscriptionModule),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LanguageService,
    JwtAuthGuard,
    PrismaService,
    GoogleService,
    GoogleStrategy,
    GoogleAuthGuard,
    TokenService,
    RateLimitGuard,
    AdminService,
    SubscriptionGuard,
    AdminGuard,
    TwoFactorService,
  ],
  exports: [
    JwtAuthGuard,
    JwtModule,
    AuthService,
    LanguageService,
    GoogleService,
    TokenService,
    RateLimitGuard,
    AdminService,
    SubscriptionGuard,
    AdminGuard,
  ],
})
export class AuthModule {}
