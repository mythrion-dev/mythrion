import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { CharacterSheetService } from './character-sheet.service.js'
import { CreateCharacterSheetDto } from './dto/create-character-sheet.dto.js'
import { UpdateCharacterSheetDto } from './dto/update-character-sheet.dto.js'
import { ResistanceCalculationService } from './resistance-calculation.service.js'
import { AcCalculationService } from './ac-calculation.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

@Controller('character-sheets')
@UseGuards(JwtAuthGuard)
export class CharacterSheetController {
  constructor(
    private readonly sheetService: CharacterSheetService,
    private readonly resistanceService: ResistanceCalculationService,
    private readonly acService: AcCalculationService,
  ) {}

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

  @Patch(':id/skills/:skillId/attribute')
  updateSkillAttribute(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('skillId') skillId: string,
    @Body('attributeId') attributeId: string | null,
  ) {
    return this.sheetService.updateSkillAttribute(id, skillId, attributeId, req.user.sub)
  }

  // ── Abilities & Summons ──

  @Get(':id/abilities')
  listAbilities(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sheetService.listAbilities(id, req.user.sub)
  }

  @Post(':id/abilities')
  createAbility(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { name: string; type?: string; description?: string; notes?: string; manaCost?: number; range?: string; damage?: string; summonAttributeValues?: { attributeId: string; value: string }[]; summonHealthCurrent?: number; summonHealthMax?: number; summonId?: string | null }) {
    return this.sheetService.createAbility(id, req.user.sub, dto)
  }

  @Patch(':id/abilities/:abilityId')
  updateAbility(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('abilityId') abilityId: string, @Body() dto: { name?: string; description?: string; notes?: string }) {
    return this.sheetService.updateAbility(abilityId, req.user.sub, dto)
  }

  @Delete(':id/abilities/:abilityId')
  removeAbility(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('abilityId') abilityId: string) {
    return this.sheetService.removeAbility(abilityId, req.user.sub)
  }

  // ── Summon-scoped abilities ──

  @Get(':id/abilities/:abilityId/summon-abilities')
  listSummonAbilities(@Req() req: AuthenticatedRequest, @Param('abilityId') abilityId: string) {
    return this.sheetService.listSummonAbilities(abilityId, req.user.sub)
  }

  @Post(':id/abilities/:abilityId/summon-abilities')
  createSummonAbility(
    @Req() req: AuthenticatedRequest,
    @Param('abilityId') abilityId: string,
    @Body() dto: { name: string; description?: string; notes?: string; manaCost?: number; range?: string; damage?: string },
  ) {
    return this.sheetService.createSummonAbility(abilityId, req.user.sub, dto)
  }

  // ── Ability Levels ──

  @Get(':id/abilities/:abilityId/levels')
  listAbilityLevels(@Req() req: AuthenticatedRequest, @Param('abilityId') abilityId: string) {
    return this.sheetService.listAbilityLevels(abilityId, req.user.sub)
  }

  @Post(':id/abilities/:abilityId/levels')
  createAbilityLevel(@Req() req: AuthenticatedRequest, @Param('abilityId') abilityId: string, @Body() dto: { level: string; description?: string; manaCost?: number; range?: string; notes?: string; damage?: string; copyFromPrevious?: boolean }) {
    return this.sheetService.createAbilityLevel(abilityId, req.user.sub, dto)
  }

  @Patch(':id/abilities/:abilityId/levels/:levelId')
  updateAbilityLevel(@Req() req: AuthenticatedRequest, @Param('levelId') levelId: string, @Body() dto: { level?: string; description?: string; manaCost?: number; range?: string; notes?: string; damage?: string }) {
    return this.sheetService.updateAbilityLevel(levelId, req.user.sub, dto)
  }

  @Delete(':id/abilities/:abilityId/levels/:levelId')
  removeAbilityLevel(@Req() req: AuthenticatedRequest, @Param('levelId') levelId: string) {
    return this.sheetService.deleteAbilityLevel(levelId, req.user.sub)
  }

  // ── Summon Skills ──

  @Post(':id/abilities/:abilityId/summon-skills')
  addSummonSkill(
    @Req() req: AuthenticatedRequest,
    @Param('abilityId') abilityId: string,
    @Body('name') name: string,
    @Body('manualValue') manualValue: number,
  ) {
    return this.sheetService.addSummonSkill(abilityId, name, manualValue ?? 0, req.user.sub)
  }

  @Delete(':id/abilities/:abilityId/summon-skills/:summonSkillId')
  removeSummonSkill(@Req() req: AuthenticatedRequest, @Param('summonSkillId') summonSkillId: string) {
    return this.sheetService.removeSummonSkill(summonSkillId, req.user.sub)
  }

  // ── Summon Attributes ──

  @Patch(':id/abilities/:abilityId/summon-attributes/:attributeId')
  updateSummonAttribute(@Req() req: AuthenticatedRequest, @Param('abilityId') abilityId: string, @Param('attributeId') attributeId: string, @Body('value') value: string) {
    return this.sheetService.updateSummonAttribute(abilityId, attributeId, value, req.user.sub)
  }

  // ── Summon AC ──

  @Patch(':id/abilities/:abilityId/summon-ac')
  updateSummonAcValue(@Req() req: AuthenticatedRequest, @Param('abilityId') abilityId: string, @Body('value') value: string) {
    return this.sheetService.updateSummonAcValue(abilityId, value, req.user.sub)
  }

  // ── Summon Health ──

  @Patch(':id/abilities/:abilityId/summon-health')
  updateSummonHealth(@Req() req: AuthenticatedRequest, @Param('abilityId') abilityId: string, @Body() dto: { current?: number | null; maximum?: number | null; notes?: string | null }) {
    return this.sheetService.updateSummonHealth(abilityId, req.user.sub, dto)
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

  // ── Character Section Entries ──

  @Get(':id/section-entries')
  listSectionEntries(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sheetService.listSectionEntries(id, req.user.sub)
  }

  @Post(':id/section-entries')
  createSectionEntry(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { sectionId: string; name: string; description?: string; notes?: string }) {
    return this.sheetService.createSectionEntry(id, req.user.sub, dto)
  }

  @Patch(':id/section-entries/:entryId')
  updateSectionEntry(@Req() req: AuthenticatedRequest, @Param('entryId') entryId: string, @Body() dto: { name?: string; description?: string; notes?: string }) {
    return this.sheetService.updateSectionEntry(entryId, req.user.sub, dto)
  }

  @Delete(':id/section-entries/:entryId')
  removeSectionEntry(@Req() req: AuthenticatedRequest, @Param('entryId') entryId: string) {
    return this.sheetService.removeSectionEntry(entryId, req.user.sub)
  }

  // ── Resistance Calculations ──

  @Get(':id/resistances')
  getCalculatedResistances(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.resistanceService.calculateResistances(id)
  }

  @Get(':id/resistances/:resistanceId')
  getCalculatedResistance(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('resistanceId') resistanceId: string,
  ) {
    return this.resistanceService.calculateSingleResistance(id, resistanceId)
  }

  @Post(':id/resistances')
  createResistance(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: { name: string; calculationType: 'MANUAL' | 'CALCULATED'; components?: { name: string; editableByPlayer?: boolean; defaultValue?: string }[]; attributeModifiers?: { attributeId: string; enabled?: boolean }[] },
  ) {
    return this.sheetService.createResistance(id, req.user.sub, dto)
  }

  @Delete(':id/resistances/:resistanceId')
  removeResistance(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('resistanceId') resistanceId: string,
  ) {
    return this.sheetService.removeResistance(id, resistanceId, req.user.sub)
  }

  // ── Professional Skills ──

  @Get(':id/professional-skills')
  listProfessionalSkills(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sheetService.listProfessionalSkills(id, req.user.sub)
  }

  @Post(':id/professional-skills')
  createProfessionalSkill(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: { name: string; attributeId?: string | null }) {
    return this.sheetService.createProfessionalSkill(id, req.user.sub, dto)
  }

  @Patch(':id/professional-skills/:skillId')
  updateProfessionalSkill(@Req() req: AuthenticatedRequest, @Param('skillId') skillId: string, @Body() dto: { name?: string; attributeId?: string | null }) {
    return this.sheetService.updateProfessionalSkill(skillId, req.user.sub, dto)
  }

  @Delete(':id/professional-skills/:skillId')
  removeProfessionalSkill(@Req() req: AuthenticatedRequest, @Param('skillId') skillId: string) {
    return this.sheetService.removeProfessionalSkill(skillId, req.user.sub)
  }

  @Patch(':id/professional-skills/:skillId/profiles/:profileId')
  updateProfessionalSkillProfileValue(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('skillId') skillId: string,
    @Param('profileId') profileId: string,
    @Body('optionId') optionId: string | null,
  ) {
    return this.sheetService.updateProfessionalSkillProfileValue(
      id,
      skillId,
      profileId,
      optionId,
      req.user.sub,
    )
  }

  // ── Armor Class Calculation ──

  @Get(':id/armor-class')
  getCalculatedArmorClass(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Query('armorClassId') armorClassId?: string) {
    return this.acService.calculateArmorClass(id, armorClassId)
  }
}
