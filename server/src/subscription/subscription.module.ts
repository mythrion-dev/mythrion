import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PrismaService } from '../prisma.service.js'
import { SubscriptionService } from './subscription.service.js'
import { SubscriptionController } from './subscription.controller.js'
import { AdminPlansController } from './admin-plans.controller.js'
import { PagBankService } from './pagbank.service.js'
import { PAYMENT_GATEWAY } from './payment-gateway.interface.js'
import { AuthModule } from '../auth/auth.module.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
    forwardRef(() => AuthModule),
  ],
  controllers: [SubscriptionController, AdminPlansController],
  providers: [
    SubscriptionService,
    PagBankService,
    PrismaService,
    { provide: PAYMENT_GATEWAY, useClass: PagBankService },
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
