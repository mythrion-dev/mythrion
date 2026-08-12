import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsNotEmpty,
  IsObject,
} from 'class-validator'
import { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma.service.js'
import { I18nService, i18nValidationMessage } from 'nestjs-i18n'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { AdminGuard } from '../auth/admin.guard.js'
import { SkipSubscriptionCheck } from '../auth/skip-subscription.decorator.js'

/* ── DTOs ─────────────────────────────────────────── */

class CreateSubscriptionPlanDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  id: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  slug: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  name: string

  @IsOptional() @IsString({ message: i18nValidationMessage('validation.isString') })
  description?: string

  /** Price in cents (BRL) */
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  price: number

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  pgPlanId: string

  /** Usage caps: { maxCampaigns?, maxTemplates? }. null/absent = unlimited. */
  @IsOptional() @IsObject({ message: i18nValidationMessage('validation.isObject') })
  limits?: Record<string, unknown> | null
}

class UpdateSubscriptionPlanDto {
  @IsOptional() @IsString({ message: i18nValidationMessage('validation.isString') }) @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  slug?: string

  @IsOptional() @IsString({ message: i18nValidationMessage('validation.isString') }) @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  name?: string

  @IsOptional() @IsString({ message: i18nValidationMessage('validation.isString') })
  description?: string

  /** Price in cents (BRL) */
  @IsOptional() @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  price?: number

  @IsOptional() @IsString({ message: i18nValidationMessage('validation.isString') }) @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  pgPlanId?: string

  /** Usage caps: { maxCampaigns?, maxTemplates? }. null/{} clears caps. */
  @IsOptional() @IsObject({ message: i18nValidationMessage('validation.isObject') })
  limits?: Record<string, unknown> | null
}

/* ── Controller ───────────────────────────────────── */

@Controller('admin/subscription-plans')
@UseGuards(JwtAuthGuard, AdminGuard)
@SkipSubscriptionCheck()
export class AdminPlansController {
  private readonly logger = new Logger(AdminPlansController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * GET /api/admin/subscription-plans
   * List all subscription plans.
   */
  @Get()
  async list() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    })
  }

  /**
   * POST /api/admin/subscription-plans
   * Create a new subscription plan.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateSubscriptionPlanDto) {
    if (!body.id || !body.slug || !body.name || body.price == null || !body.pgPlanId) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.missingRequiredFields'),
      )
    }

    // Validate price is a positive integer
    if (!Number.isInteger(body.price) || body.price <= 0) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.priceMustBePositiveInt'),
      )
    }

    // Check for conflicting slug or pgPlanId
    const existing = await this.prisma.subscriptionPlan.findFirst({
      where: {
        OR: [
          { slug: body.slug },
          { pgPlanId: body.pgPlanId },
        ],
      },
    })

    if (existing) {
      const field = existing.slug === body.slug ? 'slug' : 'pgPlanId'
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.planFieldExists', { args: { field } }),
      )
    }

    return this.prisma.subscriptionPlan.create({
      data: {
        id: body.id,
        slug: body.slug,
        name: body.name,
        description: body.description ?? null,
        price: body.price,
        pgPlanId: body.pgPlanId,
        limits: this.normalizeLimits(body.limits) ?? Prisma.DbNull,
      },
    })
  }

  /**
   * PUT /api/admin/subscription-plans/:id
   * Update an existing subscription plan.
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateSubscriptionPlanDto,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    })
    if (!plan) {
      throw new NotFoundException(
        this.i18n.t('subscription.planNotFound', { args: { planId: id } }),
      )
    }

    // Check slug uniqueness if changing
    if (body.slug && body.slug !== plan.slug) {
      await this.assertSlugUnique(body.slug)
    }

    // Check pgPlanId uniqueness if changing
    if (body.pgPlanId && body.pgPlanId !== plan.pgPlanId) {
      await this.assertPgPlanIdUnique(body.pgPlanId)
    }

    // Validate price if provided
    if (body.price != null) {
      this.assertPriceValid(body.price)
    }

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(body.slug !== undefined && { slug: body.slug }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.pgPlanId !== undefined && { pgPlanId: body.pgPlanId }),
        ...(body.limits !== undefined && { limits: this.normalizeLimits(body.limits) ?? Prisma.DbNull }),
      },
    })
  }

  /** Throw 422 if another plan already uses this slug. */
  private async assertSlugUnique(slug: string): Promise<void> {
    const slugConflict = await this.prisma.subscriptionPlan.findUnique({
      where: { slug },
    })
    if (slugConflict) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.slugInUse', { args: { slug } }),
      )
    }
  }

  /** Throw 422 if another plan already uses this PagBank plan id. */
  private async assertPgPlanIdUnique(pgPlanId: string): Promise<void> {
    const mpPlanConflict = await this.prisma.subscriptionPlan.findFirst({
      where: { pgPlanId },
    })
    if (mpPlanConflict) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.pgPlanIdInUse', {
          args: { pgPlanId },
        }),
      )
    }
  }

  /** Throw 422 if the price is not a positive integer (cents). */
  private assertPriceValid(price: number): void {
    if (!Number.isInteger(price) || price <= 0) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.priceMustBePositiveInt'),
      )
    }
  }

  /**
   * Validate and normalize a limits value for storage; null when unlimited.
   * Accepts null/{}/undefined (→ unlimited) and non-negative integer caps for
   * the known keys. Throws 422 on unknown keys or malformed values. Returns a
   * plain object so it is directly assignable to the Prisma JSON column.
   */
  private normalizeLimits(limits: unknown): Record<string, number> | null {
    if (limits == null) return null
    if (typeof limits !== 'object' || Array.isArray(limits)) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.invalidPlanLimits'),
      )
    }
    const source = limits as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(source)) {
      if (key !== 'maxCampaigns' && key !== 'maxTemplates') {
        throw new UnprocessableEntityException(
          this.i18n.t('subscription.invalidPlanLimits'),
        )
      }
      if (
        value != null &&
        (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
      ) {
        throw new UnprocessableEntityException(
          this.i18n.t('subscription.invalidPlanLimits'),
        )
      }
      out[key] = value as number
    }
    return Object.keys(out).length > 0 ? out : null
  }

  /**
   * DELETE /api/admin/subscription-plans/:id
   * Delete a subscription plan. Fails with 422 if it has active subscriptions.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    })
    if (!plan) {
      throw new NotFoundException(
        this.i18n.t('subscription.planNotFound', { args: { planId: id } }),
      )
    }

    // Check for active subscriptions
    const activeSubscriptions = await this.prisma.userSubscription.count({
      where: {
        planId: id,
        status: { in: ['AUTHORIZED', 'ACTIVE', 'GRACE'] },
      },
    })

    if (activeSubscriptions > 0) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.cannotDeletePlanWithActiveSubscriptions'),
      )
    }

    await this.prisma.subscriptionPlan.delete({
      where: { id },
    })

    return { message: this.i18n.t('subscription.planDeleted') }
  }
}
