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
import { IsBoolean } from 'class-validator'
import { AdventureService } from './adventure.service.js'
import { CreateAdventureDto } from './dto/create-adventure.dto.js'
import { UpdateAdventureDto } from './dto/update-adventure.dto.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { SubscriptionGuard } from '../auth/subscription.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

class UpdateVisibilityDto {
  @IsBoolean()
  isPublic!: boolean
}

@Controller('adventures')
@UseGuards(JwtAuthGuard)
export class AdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  @Post()
  @UseGuards(SubscriptionGuard)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAdventureDto) {
    return this.adventureService.create(req.user.sub, dto)
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.adventureService.findAllByUser(req.user.sub)
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.adventureService.findOne(id, req.user.sub)
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAdventureDto,
  ) {
    return this.adventureService.update(id, req.user.sub, dto)
  }

  @Patch(':id/visibility')
  updateVisibility(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.adventureService.updateVisibility(id, req.user.sub, dto.isPublic)
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.adventureService.remove(id, req.user.sub)
  }

  // ── NPC / Mob Endpoints (GM-only) ──

  @Get(':id/npcs')
  listNpcs(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.adventureService.listNpcs(id, req.user.sub)
  }

  @Post(':id/npcs')
  createNpc(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: { name: string; type?: string; description?: string; notes?: string },
  ) {
    return this.adventureService.createNpc(id, req.user.sub, dto)
  }

  @Patch(':id/npcs/:npcId')
  updateNpc(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('npcId') npcId: string,
    @Body() dto: { name?: string; description?: string; notes?: string },
  ) {
    return this.adventureService.updateNpc(id, npcId, req.user.sub, dto)
  }

  @Delete(':id/npcs/:npcId')
  removeNpc(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('npcId') npcId: string,
  ) {
    return this.adventureService.deleteNpc(id, npcId, req.user.sub)
  }
}