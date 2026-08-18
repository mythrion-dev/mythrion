import {
  Controller,
  Get,
  Delete,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common'
import { MembershipService } from './membership.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'
import { IsEnum, IsString } from 'class-validator'

const MemberRoleEnum = { PLAYER: 'PLAYER' as const }

class UpdateRoleDto {
  @IsEnum(MemberRoleEnum)
  role!: 'PLAYER'
}

class TransferGmDto {
  @IsString()
  newGmId!: string
}

@Controller()
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(private readonly membership: MembershipService) {}

  /** GET /adventures/:id/members */
  @Get('adventures/:adventureId/members')
  async getMembers(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
  ) {
    await this.membership.requireRole(adventureId, req.user.sub, 'PLAYER')
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
    return this.membership.requireWriteRole(adventureId, req.user.sub, 'GM').then(() =>
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
    return this.membership.requireWriteRole(adventureId, req.user.sub, 'GM').then(() =>
      this.membership.removeMember(adventureId, userId),
    )
  }

  /** POST /adventures/:adventureId/leave — a member leaves on their own */
  @Post('adventures/:adventureId/leave')
  leaveCampaign(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
  ) {
    return this.membership.leaveCampaign(adventureId, req.user.sub)
  }

  /**
   * POST /adventures/:adventureId/transfer-gm
   * GM hands the role to another player. Membership-only role gate (not
   * writability): a read-only campaign can still be handed off, since the new
   * GM's entitlement — checked inside the service — is what determines whether
   * the campaign stays writable.
   */
  @Post('adventures/:adventureId/transfer-gm')
  transferGm(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
    @Body() dto: TransferGmDto,
  ) {
    return this.membership.requireRole(adventureId, req.user.sub, 'GM').then(() =>
      this.membership.transferGm(adventureId, req.user.sub, dto.newGmId),
    )
  }

  /** GET /me/adventures — all adventures the user belongs to */
  @Get('me/adventures')
  getMyAdventures(@Req() req: AuthenticatedRequest) {
    return this.membership.getUserAdventures(req.user.sub)
  }

  /**
   * GET /adventures/:adventureId/access
   * The member's current access state for the campaign ('ACTIVE' | 'READ_ONLY').
   * Read-only derives from the GM's entitlement and cascades to every member.
   */
  @Get('adventures/:adventureId/access')
  async getAccessState(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
  ) {
    const accessState = await this.membership.getAccessState(
      adventureId,
      req.user.sub,
    )
    return { accessState }
  }
}