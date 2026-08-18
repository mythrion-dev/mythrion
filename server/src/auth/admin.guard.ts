import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { AdminService } from './admin.service.js'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly adminService: AdminService,
    private readonly i18n: I18nService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    if (!request.user?.email) {
      throw new ForbiddenException(this.i18n.t('auth.adminAuthRequired'))
    }
    return this.adminService.isAdmin(request.user.email)
  }
}
