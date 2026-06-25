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
import { CustomFieldService } from './custom-field.service.js'
import { CreateCustomFieldDto } from './dto/create-custom-field.dto.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js'

@Controller('character-sheets/:sheetId/custom-fields')
@UseGuards(JwtAuthGuard)
export class CustomFieldController {
  constructor(private readonly customFieldService: CustomFieldService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('sheetId') sheetId: string,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldService.create(sheetId, req.user.sub, dto)
  }

  @Get()
  findAllBySheet(@Param('sheetId') sheetId: string) {
    return this.customFieldService.findAllBySheet(sheetId)
  }

  @Patch(':fieldId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('fieldId') fieldId: string,
    @Body() dto: CreateCustomFieldDto,
  ) {
    return this.customFieldService.update(fieldId, req.user.sub, dto)
  }

  @Delete(':fieldId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('fieldId') fieldId: string,
  ) {
    return this.customFieldService.remove(fieldId, req.user.sub)
  }
}