import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common'
import { SubscriptionService } from './subscription.service.js'
import { MercadoPagoService } from './mercado-pago.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { SkipSubscriptionCheck } from '../auth/skip-subscription.decorator.js'
import type { Request } from 'express'

interface AuthenticatedRequest extends Request {
  user: {
    sub: string
    email: string
    role: string
  }
}

@Controller('subscriptions')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name)

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly mpService: MercadoPagoService,
  ) {}

  /**
   * GET /api/subscriptions/plans
   * Public — list all available subscription plans.
   */
  @Get('plans')
  @SkipSubscriptionCheck()
  async listPlans() {
    return this.subscriptionService.listPlans()
  }

  /**
   * POST /api/subscriptions
   * Authenticated — create a new subscription.
   * Body: { planId: string }
   * Returns the Mercado Pago Checkout Pro redirect URL.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @SkipSubscriptionCheck()
  async createSubscription(
    @Body() body: { planId: string },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!body.planId) {
      throw new UnprocessableEntityException('planId is required')
    }
    return this.subscriptionService.createSubscription(
      req.user.sub,
      body.planId,
      req.user.email,
    )
  }

  /**
   * GET /api/subscriptions/mine
   * Authenticated — get the current user's subscription details.
   */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @SkipSubscriptionCheck()
  async getMySubscription(@Req() req: AuthenticatedRequest) {
    return this.subscriptionService.getMySubscription(req.user.sub)
  }

  /**
   * POST /api/subscriptions/cancel
   * Authenticated — cancel the current user's subscription.
   */
  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Req() req: AuthenticatedRequest) {
    await this.subscriptionService.cancelSubscription(req.user.sub)
    return { message: 'Subscription cancelled successfully' }
  }

  /**
   * POST /api/subscriptions/webhook
   * Public — Mercado Pago webhook receiver.
   * Validates HMAC signature, processes subscription lifecycle events.
   */
  @Post('webhook')
  @SkipSubscriptionCheck()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    this.logger.log(`Received webhook: type="${body?.type}", data.id="${body?.data?.id}"`)

    // Validate HMAC signature
    const isValid = this.mpService.validateWebhook(
      signature,
      body?.data?.id,
      requestId,
    )

    if (!isValid) {
      this.logger.warn('Webhook signature validation failed — returning 200 to prevent retries')
      return { received: true, validated: false }
    }

    // Process the webhook event
    const result = await this.subscriptionService.processWebhook({
      type: body.type,
      action: body.action,
      data: body.data,
    })

    // Also check for expired grace-period subscriptions
    await this.subscriptionService.expireGraceSubscriptions()

    return { received: true, validated: true, action: result }
  }
}
