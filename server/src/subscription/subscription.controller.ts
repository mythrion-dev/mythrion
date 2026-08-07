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
import { I18nService } from 'nestjs-i18n'
import { SubscriptionService } from './subscription.service.js'
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
    private readonly i18n: I18nService,
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
   * Body: { planId: string, cardToken?: string, payerName?: string, payerDocument?: string, deviceId?: string }
   * Returns the checkout result.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @SkipSubscriptionCheck()
  async createSubscription(
    @Body()
    body: {
      planId: string
      cardToken?: string
      cardTokenId?: string
      securityCode?: string
      payerName?: string
      payerDocument?: string
      deviceId?: string
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!body.planId) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.controllerPlanIdRequired'),
      )
    }
    return this.subscriptionService.createSubscription(
      req.user.sub,
      body.planId,
      req.user.email,
      body.cardToken,
      body.securityCode,
      body.payerName,
      body.payerDocument,
      body.deviceId,
      body.cardTokenId,
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
    return { message: this.i18n.t('subscription.subscriptionCancelled') }
  }

  /**
   * POST /api/subscriptions/update-payment-method
   * Authenticated — update the card on the current user's subscription.
   * Body: { cardToken: string; payerName?: string; payerDocument?: string }
   * The card must be encrypted client-side via PagBank's public key.
   */
  @Post('update-payment-method')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @SkipSubscriptionCheck()
  async updatePaymentMethod(
    @Body()
    body: { cardToken: string; payerName?: string; payerDocument?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!body.cardToken) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.controllerCardTokenRequired'),
      )
    }
    await this.subscriptionService.updatePaymentMethod(
      req.user.sub,
      body.cardToken,
      body.payerName,
      body.payerDocument,
    )
    return { message: this.i18n.t('subscription.paymentMethodUpdated') }
  }

  /**
   * POST /api/subscriptions/webhook
   * Public — PagBank webhook receiver.
   * Validates SHA-256 signature via x-authenticity-token header,
   * processes subscription lifecycle events.
   */
  @Post('webhook')
  @SkipSubscriptionCheck()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-authenticity-token') authenticityToken: string | undefined,
    @Headers('x-request-id') _requestId: string | undefined,
    @Req() _req: Request,
  ) {
    this.logger.log(
      `Received webhook: event="${body?.event}" resource.id="${body?.resource?.id}"`,
    )
    this.logger.debug(`Full webhook body: ${JSON.stringify(body)}`)

    // Process the webhook event (validation happens inside the service)
    // Assinaturas API sends: { event: "subscription.activated", resource: { id: "SUBS_...", ... } }
    const result = await this.subscriptionService.processWebhook(
      JSON.stringify(body),
      authenticityToken,
      {
        type: body.event,
        action: body.action,
        data: body.resource,
      },
    )

    // Sweep for subscriptions past their grace period or cancel-at-period-end date
    await this.subscriptionService.expireGraceSubscriptions()
    await this.subscriptionService.expireCancelledSubscriptions()

    return { received: true, action: result }
  }
}
