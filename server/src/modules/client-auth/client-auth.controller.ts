import { Body, Controller, Post } from '@nestjs/common'
import { IsNotEmpty } from 'class-validator'
import { ClientAuthService } from './client-auth.service'
import { Public } from '@/common/decorators/public.decorator'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'

class WxLoginDto {
  @IsNotEmpty({ message: 'code 不能为空' })
  code: string
}

class PhoneLoginDto {
  @IsNotEmpty({ message: '手机号不能为空' })
  phone: string

  @IsNotEmpty({ message: '验证码不能为空' })
  code: string
}

class BindPhoneDto {
  @IsNotEmpty()
  phone: string
}

@Controller('client/auth')
export class ClientAuthController {
  constructor(private readonly svc: ClientAuthService) {}

  @Public()
  @Post('mini-login')
  miniLogin(@Body() dto: WxLoginDto) {
    return this.svc.miniLogin(dto.code)
  }

  // 文档中常用别名；与 mini-login 等价
  @Public()
  @Post('wechat-login')
  wechatLogin(@Body() dto: WxLoginDto) {
    return this.svc.miniLogin(dto.code)
  }

  @Public()
  @Post('phone-login')
  phoneLogin(@Body() dto: PhoneLoginDto) {
    return this.svc.phoneLogin(dto.phone, dto.code)
  }

  @Post('bind-phone')
  bindPhone(@CurrentUser() user: JwtPayload, @Body() dto: BindPhoneDto) {
    return this.svc.bindPhone(user.sub, dto.phone)
  }
}
