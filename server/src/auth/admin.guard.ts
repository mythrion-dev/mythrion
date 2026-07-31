import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { AdminService } from './admin.service.js'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminService: AdminService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    if (!request.user?.email) {
      throw new ForbiddenException('Admin access requires authentication')
    }
    return this.adminService.isAdmin(request.user.email)
  }
}
