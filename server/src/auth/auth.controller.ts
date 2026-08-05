import { Controller, Post, Patch, Get, Body, UseGuards, Req, Res, Query } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { LanguageService } from './language.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { OnboardingDto } from './dto/onboarding.dto.js'
import { LanguageDto } from './dto/language.dto.js'
import { TwoFactorSendDto } from './dto/two-factor.dto.js'
import { TwoFactorConfirmDto } from './dto/two-factor.dto.js'
import { VerifyTwoFactorDto } from './dto/two-factor.dto.js'
import { ResendTwoFactorDto } from './dto/two-factor.dto.js'
import { VerifyEmailDto } from './dto/verify-email.dto.js'
import { ResendVerificationDto } from './dto/resend-verification.dto.js'
import { ForgotPasswordDto } from './dto/forgot-password.dto.js'
import { ResetPasswordDto } from './dto/reset-password.dto.js'
import { ChangePasswordDto } from './dto/change-password.dto.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { AuthGuard } from '@nestjs/passport'
import { GoogleAuthGuard } from './google-auth.guard.js'
import { isAllowedOrigin, normalizeOrigin } from '../config/allowed-origins.js'
import { RateLimit } from './rate-limit.decorator.js'
import { RateLimitGuard } from './rate-limit.guard.js'
import type { AuthenticatedRequest } from './AuthenticatedRequest.js'
import type { Request, Response } from 'express'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3001'

/** Resolve which frontend domain to send the user back to after OAuth.
 *  The `state` param carries the origin the user started from; it is
 *  validated against the allowlist so an attacker cannot set the redirect. */
function resolveRedirectOrigin(state?: string): string {
  if (isAllowedOrigin(state)) {
    return normalizeOrigin(state) as string
  }
  return FRONTEND_URL
}

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly languageService: LanguageService,
  ) {}

  @Post('register')
  @RateLimit({ windowSeconds: 900, maxRequests: 5 })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    const language = this.languageService.normalize(req.headers['accept-language'])
    return this.authService.register(dto, language, req)
  }

  @Post('login')
  @RateLimit({ windowSeconds: 300, maxRequests: 10 })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req)
  }

  @Post('verify-2fa')
  @RateLimit({ windowSeconds: 300, maxRequests: 10 })
  verifyTwoFactor(@Body() dto: VerifyTwoFactorDto, @Req() req: Request) {
    return this.authService.verifyTwoFactor(dto, req)
  }

  @Post('verify-email')
  @RateLimit({ windowSeconds: 300, maxRequests: 10 })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto)
  }

  @Post('resend-verification')
  @RateLimit({ windowSeconds: 300, maxRequests: 5 })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto)
  }

  @Post('forgot-password')
  @RateLimit({ windowSeconds: 300, maxRequests: 5 })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto)
  }

  @Post('reset-password')
  @RateLimit({ windowSeconds: 300, maxRequests: 5 })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto)
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ windowSeconds: 300, maxRequests: 5 })
  changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, dto, req)
  }

  @Post('2fa/resend')
  @RateLimit({ windowSeconds: 300, maxRequests: 5 })
  resendTwoFactorCode(@Body() dto: ResendTwoFactorDto) {
    return this.authService.resendTwoFactorCode(dto)
  }

  @Post('2fa/send')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ windowSeconds: 300, maxRequests: 5 })
  sendTwoFactorCode(@Req() req: AuthenticatedRequest, @Body() dto: TwoFactorSendDto) {
    return this.authService.sendTwoFactorCode(req.user.sub, dto.purpose)
  }

  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard)
  @RateLimit({ windowSeconds: 300, maxRequests: 10 })
  confirmTwoFactor(@Req() req: AuthenticatedRequest, @Body() dto: TwoFactorConfirmDto) {
    return this.authService.confirmTwoFactor(req.user.sub, dto.purpose, dto)
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken)
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.sub)
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub)
  }

  @Patch('language')
  @UseGuards(JwtAuthGuard)
  updateLanguage(@Req() req: AuthenticatedRequest, @Body() dto: LanguageDto) {
    return this.languageService.updateLanguage(req.user.sub, dto.language)
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

  /** Google OAuth — redirect to Google. The guard threads the requesting
   *  frontend origin through `state` so the callback can redirect back. */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // Guard redirects to Google
  }

  /** Google OAuth callback — returns tokens via redirect. The static
   *  GOOGLE_CALLBACK_URL is unchanged; only the final redirect target varies
   *  per frontend domain, resolved from the validated `state`. */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response, @Query('state') state?: string) {
    const { accessToken, refreshToken } = req.user
    const params = new URLSearchParams()
    params.set('token', accessToken)
    params.set('refreshToken', refreshToken)
    const origin = resolveRedirectOrigin(state)
    res.redirect(`${origin}/auth/google/callback?${params.toString()}`)
  }
}