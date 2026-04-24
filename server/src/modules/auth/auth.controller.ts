import { Body, Controller, Get, Ip, Post } from '@nestjs/common'
import { IsNotEmpty, MinLength } from 'class-validator'
import { AuthService } from './auth.service'
import { Public } from '@/common/decorators/public.decorator'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'

class LoginDto {
  @IsNotEmpty({ message: '请输入账号' })
  username: string

  @IsNotEmpty({ message: '请输入密码' })
  @MinLength(6, { message: '密码至少 6 位' })
  password: string
}

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.adminLogin(dto.username, dto.password, ip)
  }

  @Get('profile')
  async profile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub)
  }

  @Post('logout')
  async logout() {
    // 无状态 JWT，前端清 token 即可；如需黑名单可接 Redis
    return { ok: true }
  }
}
