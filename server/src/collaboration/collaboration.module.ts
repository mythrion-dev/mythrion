import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { EmailService } from '../email/email.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { MembershipController } from '../membership/membership.controller.js'
import { InvitationService } from '../invitation/invitation.service.js'
import { InvitationController } from '../invitation/invitation.controller.js'
import { PrismaService } from '../prisma.service.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [InvitationController, MembershipController],
  providers: [
    EmailService,
    MembershipService,
    InvitationService,
    PrismaService,
  ],
  exports: [EmailService, MembershipService, InvitationService],
})
export class CollaborationModule {}