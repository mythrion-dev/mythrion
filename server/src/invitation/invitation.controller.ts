import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common'
import { InvitationService } from './invitation.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'
import { IsEmail, IsEnum } from 'class-validator'

const MemberRoleEnum = { GM: 'GM' as const, PLAYER: 'PLAYER' as const }

class InviteByEmailDto {
  @IsEmail()
  email!: string

  @IsEnum(MemberRoleEnum)
  role!: 'GM' | 'PLAYER'
}

class InviteByLinkDto {
  @IsEnum(MemberRoleEnum)
  role!: 'GM' | 'PLAYER'
}

@Controller()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  /** POST /adventures/:id/invitations/email */
  @Post('adventures/:adventureId/invitations/email')
  @UseGuards(JwtAuthGuard)
  inviteByEmail(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
    @Body() dto: InviteByEmailDto,
  ) {
    return this.invitationService.inviteByEmail({
      adventureId,
      invitedEmail: dto.email,
      role: dto.role,
      createdById: req.user.sub,
    })
  }

  /** POST /adventures/:id/invitations/link */
  @Post('adventures/:adventureId/invitations/link')
  @UseGuards(JwtAuthGuard)
  inviteByLink(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
    @Body() dto: InviteByLinkDto,
  ) {
    return this.invitationService.inviteByLink({
      adventureId,
      role: dto.role,
      createdById: req.user.sub,
    })
  }

  /** GET /invitations/:token — public validation */
  @Get('invitations/:token')
  validate(@Param('token') token: string) {
    return this.invitationService.validate(token)
  }

  /** POST /invitations/:token/accept */
  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  accept(
    @Req() req: AuthenticatedRequest,
    @Param('token') token: string,
  ) {
    return this.invitationService.accept(token, req.user.sub)
  }

  /** GET /adventures/:id/invitations — list pending */
  @Get('adventures/:adventureId/invitations')
  @UseGuards(JwtAuthGuard)
  listForAdventure(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
  ) {
    return this.invitationService.listForAdventure(adventureId, req.user.sub)
  }

  /** POST /invitations/:id/revoke */
  @Post('invitations/:invitationId/revoke')
  @UseGuards(JwtAuthGuard)
  revoke(
    @Req() req: AuthenticatedRequest,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationService.revoke(invitationId, req.user.sub)
  }
}