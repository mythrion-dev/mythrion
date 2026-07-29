import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common'
import { TemplateService } from './template.service.js'
import { CreateTemplateDto } from './dto/create-template.dto.js'
import { UpdateTemplateDto } from './dto/update-template.dto.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { SubscriptionGuard } from '../auth/subscription.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

/**
 * Controller for standalone template operations (no adventure context).
 * Mounted at /templates (not scoped under adventures/:adventureId).
 */
@Controller('templates')
@UseGuards(JwtAuthGuard)
export class StandaloneTemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * POST /templates — Create a standalone template owned by the user
   * Requires an active subscription (free tier cannot create templates).
   */
  @Post()
  @UseGuards(SubscriptionGuard)
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templateService.createStandalone(req.user.sub, dto)
  }

  /**
   * GET /templates — List the authenticated user's templates
   */
  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.templateService.findAllByUser(req.user.sub)
  }

  /**
   * GET /templates/:id — Get a single template
   * Auth: owner, adventure member, or public template
   */
  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.templateService.findOne(id, req.user.sub)
  }

  /**
   * PATCH /templates/:id — Update a template
   * Auth: owner or GM of associated adventure
   */
  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.update(id, req.user.sub, dto)
  }

  /**
   * DELETE /templates/:id — Delete a template
   * Auth: owner or GM; blocked if character sheets reference it
   */
  @Delete(':id')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.templateService.remove(id, req.user.sub)
  }

  /**
   * POST /templates/:id/clone — Clone a template into the user's library
   * Public templates can be cloned by any authenticated user;
   * otherwise owner or adventure GM can clone.
   * Fixes existing frontend bug: frontend calls this endpoint but no route existed.
   */
  @Post(':id/clone')
  clone(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('name') newName?: string,
  ) {
    return this.templateService.clone(id, req.user.sub, newName)
  }
}
