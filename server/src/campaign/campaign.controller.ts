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
import { CampaignService } from './campaign.service.js'
import { CreateCampaignDto } from './dto/create-campaign.dto.js'
import { UpdateCampaignDto } from './dto/update-campaign.dto.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'

interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string }
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCampaignDto) {
    return this.campaignService.create(req.user.sub, dto)
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.campaignService.findAllByUser(req.user.sub)
  }

  @Get(':id')
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.campaignService.findOne(id, req.user.sub)
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignService.update(id, req.user.sub, dto)
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.campaignService.remove(id, req.user.sub)
  }
}