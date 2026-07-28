import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { JoinRequestService } from './join-request.service.js'
import { JoinRequestController } from './join-request.controller.js'
import { PrismaService } from '../prisma.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { CollaborationModule } from '../collaboration/collaboration.module.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    CollaborationModule,
  ],
  controllers: [JoinRequestController],
  providers: [JoinRequestService, PrismaService, JwtAuthGuard],
  exports: [JoinRequestService],
})
export class JoinRequestModule {}
