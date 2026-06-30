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
import { CharacterSheetService } from './character-sheet.service.js'
import { CreateCharacterSheetDto } from './dto/create-character-sheet.dto.js'
import { UpdateCharacterSheetDto } from './dto/update-character-sheet.dto.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js'

@Controller('character-sheets')
@UseGuards(JwtAuthGuard)
export class CharacterSheetController {
  constructor(private readonly sheetService: CharacterSheetService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCharacterSheetDto) {
    return this.sheetService.create(req.user.sub, dto)
  }

  @Get()
  findAllByUser(@Req() req: AuthenticatedRequest) {
    return this.sheetService.findAllByUser(req.user.sub)
  }

  @Get('adventure/:adventureId')
  findAllByAdventure(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
  ) {
    return this.sheetService.findAllByAdventure(adventureId, req.user.sub)
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sheetService.findOne(id, req.user.sub)
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCharacterSheetDto,
  ) {
    return this.sheetService.update(id, req.user.sub, dto)
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sheetService.remove(id, req.user.sub)
  }

  @Post(':id/link')
  linkToAdventure(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('adventureId') adventureId: string,
  ) {
    return this.sheetService.linkToAdventure(id, adventureId, req.user.sub)
  }

  @Post(':id/unlink')
  unlinkFromAdventure(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.sheetService.unlinkFromAdventure(id, req.user.sub)
  }

  @Patch(':id/skills/:skillId/profiles/:profileId')
  updateSkillProfileValue(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('skillId') skillId: string,
    @Param('profileId') profileId: string,
    @Body('optionId') optionId: string | null,
  ) {
    return this.sheetService.updateSkillProfileValue(
      id,
      skillId,
      profileId,
      optionId,
      req.user.sub,
    )
  }

  // ── Abilities ──

  @Get(':id/abilities')
  listAbilities(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sheetService.listAbilities(id, req.user.sub)
  }

  @Post(':id/abilities')
  createAbility(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { name: string; description?: string; manaCost?: number; cooldown?: string; notes?: string }) {
    return this.sheetService.createAbility(id, req.user.sub, dto)
  }

  @Patch(':id/abilities/:abilityId')
  updateAbility(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('abilityId') abilityId: string, @Body() dto: { name?: string; description?: string; manaCost?: number; cooldown?: string; notes?: string }) {
    return this.sheetService.updateAbility(abilityId, req.user.sub, dto)
  }

  @Delete(':id/abilities/:abilityId')
  removeAbility(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('abilityId') abilityId: string) {
    return this.sheetService.removeAbility(abilityId, req.user.sub)
  }

  // ── Inventory ──

  @Get(':id/inventory')
  listInventory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sheetService.listInventory(id, req.user.sub)
  }

  @Post(':id/inventory')
  createInventoryItem(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { name: string; weight?: number; cost?: string; description?: string }) {
    return this.sheetService.createInventoryItem(id, req.user.sub, dto)
  }

  @Patch(':id/inventory/:itemId')
  updateInventoryItem(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: { name?: string; weight?: number; cost?: string; description?: string }) {
    return this.sheetService.updateInventoryItem(itemId, req.user.sub, dto)
  }

  @Delete(':id/inventory/:itemId')
  removeInventoryItem(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.sheetService.removeInventoryItem(itemId, req.user.sub)
  }

  // ── Story ──

  @Get(':id/story')
  getStory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sheetService.getStory(id, req.user.sub)
  }

  @Patch(':id/story')
  updateStory(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { appearance?: string; backstory?: string; personality?: string; goals?: string; notes?: string }) {
    return this.sheetService.updateStory(id, req.user.sub, dto)
  }
}
