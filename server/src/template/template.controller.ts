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
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js'

@Controller('adventures/:adventureId/templates')
@UseGuards(JwtAuthGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templateService.create(adventureId, req.user.sub, dto)
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
  ) {
    return this.templateService.findAllByAdventure(adventureId, req.user.sub)
  }

  @Get(':templateId')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
  ) {
    return this.templateService.findOne(templateId, req.user.sub)
  }

  @Patch(':templateId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templateService.update(templateId, req.user.sub, dto)
  }

  @Delete(':templateId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
  ) {
    return this.templateService.remove(templateId, req.user.sub)
  }
}