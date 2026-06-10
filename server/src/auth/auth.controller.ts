import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { OnboardingDto } from './dto/onboarding.dto.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'

interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string }
}

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
}