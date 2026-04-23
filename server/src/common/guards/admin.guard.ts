import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common'

/** 仅允许管理端账号访问 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    if (req.user?.userType !== 'admin') {
      throw new ForbiddenException('仅管理员可访问此接口')
    }
    return true
  }
}
