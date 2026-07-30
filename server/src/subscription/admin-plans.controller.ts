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
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { AdminGuard } from '../auth/admin.guard.js'
import { SkipSubscriptionCheck } from '../auth/skip-subscription.decorator.js'

/* ── DTOs ─────────────────────────────────────────── */

class CreateSubscriptionPlanDto {
  @IsString() @IsNotEmpty()
  id: string

  @IsString() @IsNotEmpty()
  slug: string

  @IsString() @IsNotEmpty()
  name: string

  @IsOptional() @IsString()
  description?: string

  /** Price in cents (BRL) */
  @IsInt() @Min(1)
  price: number

  @IsString() @IsNotEmpty()
  pgPlanId: string
}

class UpdateSubscriptionPlanDto {
  @IsOptional() @IsString() @IsNotEmpty()
  slug?: string

  @IsOptional() @IsString() @IsNotEmpty()
  name?: string

  @IsOptional() @IsString()
  description?: string

  /** Price in cents (BRL) */
  @IsOptional() @IsInt() @Min(1)
  price?: number

  @IsOptional() @IsString() @IsNotEmpty()
  pgPlanId?: string
}

/* ── Controller ───────────────────────────────────── */

@Controller('admin/subscription-plans')
@UseGuards(JwtAuthGuard, AdminGuard)
@SkipSubscriptionCheck()
export class AdminPlansController {
  private readonly logger = new Logger(AdminPlansController.name)

  constructor(private readonly prisma: PrismaService) {}

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
        'Missing required fields: id, slug, name, price, pgPlanId',
      )
    }

    // Validate price is a positive integer
    if (!Number.isInteger(body.price) || body.price <= 0) {
      throw new UnprocessableEntityException('Price must be a positive integer (cents)')
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
      throw new UnprocessableEntityException(`A plan with this ${field} already exists`)
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
      throw new NotFoundException(`Subscription plan "${id}" not found`)
    }

    // Check slug uniqueness if changing
    if (body.slug && body.slug !== plan.slug) {
      const slugConflict = await this.prisma.subscriptionPlan.findUnique({
        where: { slug: body.slug },
      })
      if (slugConflict) {
        throw new UnprocessableEntityException(`Slug "${body.slug}" is already in use`)
      }
    }

    // Check pgPlanId uniqueness if changing
    if (body.pgPlanId && body.pgPlanId !== plan.pgPlanId) {
      const mpPlanConflict = await this.prisma.subscriptionPlan.findFirst({
        where: { pgPlanId: body.pgPlanId },
      })
      if (mpPlanConflict) {
        throw new UnprocessableEntityException(`pgPlanId "${body.pgPlanId}" is already in use`)
      }
    }

    // Validate price if provided
    if (body.price != null && (!Number.isInteger(body.price) || body.price <= 0)) {
      throw new UnprocessableEntityException('Price must be a positive integer (cents)')
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
      throw new NotFoundException(`Subscription plan "${id}" not found`)
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
        'Cannot delete plan with active subscriptions.',
      )
    }

    await this.prisma.subscriptionPlan.delete({
      where: { id },
    })

    return { message: 'Plan deleted successfully' }
  }
}
