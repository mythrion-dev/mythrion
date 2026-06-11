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
import { AdventureService } from './adventure.service.js'
import { CreateAdventureDto } from './dto/create-adventure.dto.js'
import { UpdateAdventureDto } from './dto/update-adventure.dto.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

@Controller('adventures')
@UseGuards(JwtAuthGuard)
export class AdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  @Post()
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

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.adventureService.remove(id, req.user.sub)
  }
}