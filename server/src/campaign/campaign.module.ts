import { Module } from '@nestjs/common'
import { CampaignService } from './campaign.service.js'
import { CampaignController } from './campaign.controller.js'
import { PrismaService } from '../prisma.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { JwtModule } from '@nestjs/jwt'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [CampaignController],
  providers: [CampaignService, PrismaService, JwtAuthGuard],
  exports: [CampaignService],
})
export class CampaignModule {}