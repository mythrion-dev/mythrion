import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common'
import { TemplateService } from '../template/template.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

/**
 * Controller for adventure-template attachment operations.
 * Mounted at /adventures/:id/template (singular — one attached template per adventure).
 */
@Controller('adventures/:id/template')
@UseGuards(JwtAuthGuard)
export class AdventureTemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * POST /adventures/:id/template/attach — Attach a template and create snapshot
   * Auth: GM only
   * Body: { templateId: string }
   */
  @Post('attach')
  attach(
    @Req() req: AuthenticatedRequest,
    @Param('id') adventureId: string,
    @Body('templateId') templateId: string,
  ) {
    return this.templateService.attachToAdventure(templateId, adventureId, req.user.sub)
  }

  /**
   * POST /adventures/:id/template/replace — Replace the attached template (atomic swap)
   * Auth: GM only
   * Body: { templateId: string }
   */
  @Post('replace')
  replace(
    @Req() req: AuthenticatedRequest,
    @Param('id') adventureId: string,
    @Body('templateId') templateId: string,
  ) {
    return this.templateService.replaceAdventureTemplate(templateId, adventureId, req.user.sub)
  }

  /**
   * GET /adventures/:id/template/snapshot — Get the attached template snapshot
   * Auth: MEMBER or higher
   */
  @Get('snapshot')
  getSnapshot(
    @Req() req: AuthenticatedRequest,
    @Param('id') adventureId: string,
  ) {
    return this.templateService.getTemplateSnapshot(adventureId, req.user.sub)
  }

  /**
   * DELETE /adventures/:id/template/detach — Detach template link (keeps snapshot)
   * Auth: GM only
   */
  @Delete('detach')
  detach(
    @Req() req: AuthenticatedRequest,
    @Param('id') adventureId: string,
  ) {
    return this.templateService.detachFromAdventure(adventureId, req.user.sub)
  }
}
