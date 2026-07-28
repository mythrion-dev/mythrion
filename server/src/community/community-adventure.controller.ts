import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { AdventureService } from '../adventure/adventure.service.js'

@Controller('public/adventures')
export class CommunityAdventureController {
  constructor(private readonly adventureService: AdventureService) {}

  /**
   * GET /public/adventures
   * List public adventures with pagination and optional filters.
   */
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('campaign') campaign?: string,
    @Query('search') search?: string,
  ) {
    return this.adventureService.findPublic({ page, limit, campaign, search })
  }

  /**
   * GET /public/adventures/:id
   * Get a single public adventure with public-facing fields.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adventureService.findOnePublic(id)
  }
}
