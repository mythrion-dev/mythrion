import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { GoogleController } from './google.controller.js'
import { GoogleService } from './google.service.js'
import { GoogleStrategy } from './google.strategy.js'
import { PrismaService } from '../prisma.service.js'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [GoogleController],
  providers: [GoogleService, GoogleStrategy, PrismaService],
  exports: [GoogleService],
})
export class GoogleModule {}