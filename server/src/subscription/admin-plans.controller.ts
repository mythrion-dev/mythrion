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
} from 'class-validator'
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
      const slugConflict = await this.prisma.subscriptionPlan.findUnique({
        where: { slug: body.slug },
      })
      if (slugConflict) {
        throw new UnprocessableEntityException(
          this.i18n.t('subscription.slugInUse', { args: { slug: body.slug } }),
        )
      }
    }

    // Check pgPlanId uniqueness if changing
    if (body.pgPlanId && body.pgPlanId !== plan.pgPlanId) {
      const mpPlanConflict = await this.prisma.subscriptionPlan.findFirst({
        where: { pgPlanId: body.pgPlanId },
      })
      if (mpPlanConflict) {
        throw new UnprocessableEntityException(
          this.i18n.t('subscription.pgPlanIdInUse', {
            args: { pgPlanId: body.pgPlanId },
          }),
        )
      }
    }

    // Validate price if provided
    if (body.price != null && (!Number.isInteger(body.price) || body.price <= 0)) {
      throw new UnprocessableEntityException(
        this.i18n.t('subscription.priceMustBePositiveInt'),
      )
    }

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(body.slug !== undefined && { slug: body.slug }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.pgPlanId !== undefined && { pgPlanId: body.pgPlanId }),
      },
    })
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
