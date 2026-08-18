import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common'
import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator'
import { JoinRequestService } from './join-request.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

class CreateJoinRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  message?: string
}

class ActionJoinRequestDto {
  @IsString()
  @IsIn(['accept', 'reject'])
  action!: 'accept' | 'reject'
}

@Controller()
export class JoinRequestController {
  constructor(private readonly joinRequestService: JoinRequestService) {}

  /**
   * POST /adventures/:adventureId/join-requests
   * Create a join request for a public adventure (authenticated user).
   */
  @Post('adventures/:adventureId/join-requests')
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
    @Body() dto: CreateJoinRequestDto,
  ) {
    return this.joinRequestService.create(adventureId, req.user.sub, dto.message)
  }

  /**
   * GET /adventures/:adventureId/join-requests
   * List join requests for an adventure (GM only).
   */
  @Get('adventures/:adventureId/join-requests')
  @UseGuards(JwtAuthGuard)
  findByAdventure(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
  ) {
    return this.joinRequestService.findByAdventure(adventureId, req.user.sub)
  }

  /**
   * PATCH /adventures/:adventureId/join-requests/:requestId
   * Accept or reject a join request (GM only).
   */
  @Patch('adventures/:adventureId/join-requests/:requestId')
  @UseGuards(JwtAuthGuard)
  handleAction(
    @Req() req: AuthenticatedRequest,
    @Param('adventureId') adventureId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ActionJoinRequestDto,
  ) {
    if (dto.action === 'accept') {
      return this.joinRequestService.accept(adventureId, requestId, req.user.sub)
    }
    return this.joinRequestService.reject(adventureId, requestId, req.user.sub)
  }

  /**
   * GET /my/join-requests
   * Get all join requests made by the authenticated user.
   */
  @Get('my/join-requests')
  @UseGuards(JwtAuthGuard)
  findMyRequests(@Req() req: AuthenticatedRequest) {
    return this.joinRequestService.findMyRequests(req.user.sub)
  }
}
