import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common'
import { MembershipService } from './membership.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'
import { IsEnum } from 'class-validator'

const MemberRoleEnum = { GM: 'GM' as const, PLAYER: 'PLAYER' as const }

class UpdateRoleDto {
  @IsEnum(MemberRoleEnum)
  role!: 'GM' | 'PLAYER'
}

@Controller()
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(private readonly membership: MembershipService) {}

  /** GET /adventures/:id/members */
  @Get('adventures/:adventureId/members')
  getMembers(@Param('adventureId') adventureId: string) {
    return this.membership.getMembers(adventureId)
  }

  /** PATCH /adventures/:adventureId/members/:userId/role */
  @Patch('adventures/:adventureId/members/:userId/role')
  updateRole(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.membership.requireRole(adventureId, req.user.sub, 'GM').then(() =>
      this.membership.updateRole(adventureId, userId, dto.role),
    )
  }

  /** DELETE /adventures/:adventureId/members/:userId */
  @Delete('adventures/:adventureId/members/:userId')
  removeMember(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
    @Param('userId') userId: string,
  ) {
    return this.membership.requireRole(adventureId, req.user.sub, 'GM').then(() =>
      this.membership.removeMember(adventureId, userId),
    )
  }

  /** GET /me/adventures — all adventures the user belongs to */
  @Get('me/adventures')
  getMyAdventures(@Req() req: AuthenticatedRequest) {
    return this.membership.getUserAdventures(req.user.sub)
  }
}