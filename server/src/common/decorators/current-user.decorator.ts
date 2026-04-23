import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface JwtPayload {
  sub: number // user id
  username: string
  userType: 'admin' | 'client' // 管理端账号 vs 小程序/H5 用户
  role?: string
  roles?: string[]
  perms?: string[]
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest()
    return req.user
  },
)
