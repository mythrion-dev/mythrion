import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { TemplateService } from '../template/template.service.js'

@Controller('public/templates')
export class CommunityTemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * GET /public/templates
   * List public templates with pagination and optional filters.
   */
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('adventureId') adventureId?: string,
    @Query('campaign') campaign?: string,
    @Query('search') search?: string,
  ) {
    return this.templateService.findPublicAll({ page, limit, adventureId, campaign, search })
  }

  /**
   * GET /public/templates/:id
   * Get a single public template with its full structure.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templateService.findOnePublic(id)
  }
}
