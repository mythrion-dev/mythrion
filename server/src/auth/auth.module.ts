import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { PrismaService } from '../prisma.service.js'
import { GoogleService } from './google.service.js'
import { GoogleStrategy } from './google.strategy.js'
import { DiscordService } from './discord.service.js'
import { DiscordStrategy } from './discord.strategy.js'
import { DiscordAuthGuard } from './discord-auth.guard.js'
import { TokenService } from './token.service.js'

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
    DiscordService,
    DiscordStrategy,
    DiscordAuthGuard,
    TokenService,
  ],
  exports: [JwtAuthGuard, JwtModule, AuthService, GoogleService, DiscordService, TokenService],
})
export class AuthModule {}
