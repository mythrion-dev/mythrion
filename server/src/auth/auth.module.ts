import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { PrismaService } from '../prisma.service.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PrismaService],
  exports: [JwtAuthGuard, JwtModule, AuthService],
})
export class AuthModule {}