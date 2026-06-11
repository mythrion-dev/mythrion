import { Module } from '@nestjs/common'
import { AdventureService } from './adventure.service.js'
import { AdventureController } from './adventure.controller.js'
import { PrismaService } from '../prisma.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { JwtModule } from '@nestjs/jwt'
import { CollaborationModule } from '../collaboration/collaboration.module.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    CollaborationModule,
  ],
  controllers: [AdventureController],
  providers: [AdventureService, PrismaService, JwtAuthGuard],
  exports: [AdventureService],
})
export class AdventureModule {}
