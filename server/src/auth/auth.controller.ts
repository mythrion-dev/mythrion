import { Controller, Post, Get, Body, UseGuards, Req, Res } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { OnboardingDto } from './dto/onboarding.dto.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { AuthGuard } from '@nestjs/passport'
import type { AuthenticatedRequest } from './AuthenticatedRequest.js'
import type { Request, Response } from 'express'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3001'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub)
  }

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  completeOnboarding(@Req() req: AuthenticatedRequest, @Body() dto: OnboardingDto) {
    return this.authService.completeOnboarding(req.user.sub, dto)
  }

  @Get('current-user')
  @UseGuards(JwtAuthGuard)
  async currentUser(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub
    const profile = await this.authService.getProfile(userId)
    const ip = this.authService.getRequestIp(req)
    const location = await this.authService.getLocationFromIp(ip)

    return {
      ...profile,
      ip,
      location,
    }
  }

  /** Google OAuth — redirect to Google */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Guard redirects to Google
  }

  /** Google OAuth callback — returns JWT via redirect */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken } = req.user
    res.redirect(`${FRONTEND_URL}/auth/google/callback?token=${accessToken}`)
  }

  /** Discord OAuth — redirect to Discord */
  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  discordAuth() {
    // Guard redirects to Discord
  }

  /** Discord OAuth callback — returns JWT via redirect */
  @Get('discord/callback')
  @UseGuards(AuthGuard('discord'))
  async discordCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken } = req.user
    res.redirect(`${FRONTEND_URL}/auth/discord/callback?token=${accessToken}`)
  }

  @Get('discord-profile')
  @UseGuards(JwtAuthGuard)
  async getDiscordProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getDiscordAccount(req.user.sub)
  }
}