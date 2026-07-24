import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { SubscriptionService } from './subscription.service.js'
import { SubscriptionController } from './subscription.controller.js'
import { MercadoPagoService } from './mercado-pago.service.js'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, MercadoPagoService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
