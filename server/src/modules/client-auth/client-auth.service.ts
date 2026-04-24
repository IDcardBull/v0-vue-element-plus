import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { PrismaService } from '@/common/prisma.service'

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 微信小程序登录：前端 wx.login 得到 code，传给后端换 openid
   * 首次登录自动建档 users 表（role=retail）
   */
  async miniLogin(code: string) {
    if (!code) throw new BadRequestException('code 不能为空')

    const appid = this.config.get<string>('WX_APPID')
    const secret = this.config.get<string>('WX_SECRET')
    if (!appid || !secret) throw new UnauthorizedException('微信小程序未配置')

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
    const { data } = await axios.get(url, { timeout: 5000 })
    if (data.errcode) throw new UnauthorizedException(`微信登录失败：${data.errmsg}`)

    const { openid, unionid } = data
    let user = await this.prisma.user.findUnique({ where: { openid } })
    if (!user) {
      user = await this.prisma.user.create({
        data: { openid, unionid: unionid || null, role: 'retail' },
      })
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      })
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      username: user.phone || user.openid,
      userType: 'client',
      role: user.role,
    })
    return { token, user: this.sanitize(user) }
  }

  /**
   * 手机号+验证码登录（零售、批发 H5 通用），演示版跳过短信校验
   */
  async phoneLogin(phone: string, code: string) {
    if (!phone || !code) throw new BadRequestException('手机号和验证码必填')
    // TODO: 生产环境请接入腾讯云短信 SDK 校验验证码
    if (code !== '123456') throw new UnauthorizedException('验证码错误')

    let user = await this.prisma.user.findUnique({ where: { phone } })
    if (!user) {
      user = await this.prisma.user.create({ data: { phone, role: 'retail' } })
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      })
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      username: user.phone!,
      userType: 'client',
      role: user.role,
    })
    return { token, user: this.sanitize(user) }
  }

  /** 绑定手机号 */
  async bindPhone(userId: number, phone: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { phone } })
    return { ok: true }
  }

  private sanitize(u: any) {
    return {
      id: u.id,
      nickname: u.nickname,
      avatar: u.avatar,
      phone: u.phone,
      role: u.role,
      levelId: u.levelId,
      points: u.points,
    }
  }
}
