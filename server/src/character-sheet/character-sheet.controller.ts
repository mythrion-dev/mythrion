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
}