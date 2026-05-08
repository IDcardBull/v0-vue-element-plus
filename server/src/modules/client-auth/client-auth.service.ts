import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { PrismaService } from '@/common/prisma.service'
import { WechatPayService, MiniChannel } from '../client/wechat-pay.service'

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly wxpay: WechatPayService,
  ) {}

  /**
   * 微信小程序登录：前端 wx.login 得到 code，传给后端换 openid
   *
   * channel 决定了用哪个小程序的 AppID+Secret 调 jscode2session，
   * 同一微信号在两个小程序里 openid 不同 → 自动产生两条 User 记录，互不干扰。
   * 之后这个用户的所有支付都用 user.appChannel 对应的 AppID。
   */
  async miniLogin(code: string, channel: MiniChannel = 'retail') {
    if (!code) throw new BadRequestException('code 不能为空')

    const { appid, secret } = this.wxpay.getChannelCreds(channel)
    const devFallbackEnabled = this.config.get<string>('WX_LOGIN_DEV_FALLBACK') === 'true'

    if (!appid || !secret) {
      if (devFallbackEnabled) return this.devMiniLogin('missing-config', channel)
      throw new UnauthorizedException(
        `${channel} 端微信小程序未配置 (缺少 WX_APPID_${channel.toUpperCase()} / WX_SECRET_${channel.toUpperCase()})`,
      )
    }

    try {
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
      const { data } = await axios.get(url, { timeout: 5000 })
      if (data.errcode) {
        if (devFallbackEnabled) return this.devMiniLogin(`wechat-${data.errcode}`, channel)
        // 把后端实际在用的 appid 暴露出来，前端 toast 直接告诉用户两边对照
        // 40029 invalid code = 客户端 AppID 与后端 jscode2session 用的 AppID 不一致
        // 40125 invalid appsecret = AppSecret 配错
        // 45011 = 同一 code 被换了多次（频率限制）
        const hint =
          data.errcode === 40029
            ? `\n  → 后端用的 AppID=${appid} 与小程序客户端 AppID 不匹配，请核对 server/.env 的 WX_APPID${channel === 'wholesale' ? '_WHOLESALE' : '_RETAIL'}（或 WX_APPID）和 miniprogram/project.config.json 里的 appid 是否一致`
            : data.errcode === 40125
            ? `\n  → AppSecret 配错，请去微信公众平台 → 开发 → 开发设置 重置 secret 后更新 server/.env 的 WX_SECRET`
            : data.errcode === 45011
            ? `\n  → 频率超限或 code 被复用，1 分钟后重试；前端确保 wx.login 拿到的 code 只调一次后端`
            : ''
        throw new UnauthorizedException(`微信登录失败：${data.errmsg}${hint}`)
      }

      const { openid, unionid } = data
      return this.loginByOpenid(openid, unionid || null, channel)
    } catch (error: any) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) throw error
      if (devFallbackEnabled) return this.devMiniLogin('request-failed', channel)
      throw new UnauthorizedException(error?.message || '微信登录失败')
    }
  }

  private async loginByOpenid(openid: string, unionid: string | null, channel: MiniChannel) {
    let user = await this.prisma.user.findUnique({ where: { openid } })
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          openid,
          unionid: unionid || null,
          // 批发小程序用户默认 dealer 角色（待审核），零售默认 retail
          role: channel === 'wholesale' ? 'dealer' : 'retail',
          appChannel: channel,
        },
      })
    } else {
      // 已存在用户：更新最后活跃时间，并校正 appChannel（万一历史数据缺失）
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          ...(user.appChannel !== channel ? { appChannel: channel } : {}),
        },
      })
    }

    const token = await this.signClientToken(user)
    return { token, user: this.sanitize(user) }
  }

  /** 开发回退：没有真实 AppID/Secret 时给一个固定 openid 跑通登录链路 */
  private async devMiniLogin(reason: string, channel: MiniChannel) {
    const fakeAppid = this.wxpay.getChannelCreds(channel).appid || channel
    const openid = `dev_${fakeAppid}_local`
    const result = await this.loginByOpenid(openid, null, channel)
    return { ...result, dev: true, reason }
  }

  private signClientToken(user: any) {
    return this.jwt.signAsync({
      sub: user.id,
      username: user.phone || user.openid,
      userType: 'client',
      role: user.role,
      appChannel: user.appChannel,
    })
  }

  /**
   * 手机号+验证码登录（零售、批发 H5 通用），演示版跳过短信校验
   */
  async phoneLogin(phone: string, code: string, channel: MiniChannel = 'retail') {
    if (!phone || !code) throw new BadRequestException('手机号和验证码必填')
    // TODO: 生产环境请接入腾讯云短信 SDK 校验验证码
    if (code !== '123456') throw new UnauthorizedException('验证码错误')

    let user = await this.prisma.user.findUnique({ where: { phone } })
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          role: channel === 'wholesale' ? 'dealer' : 'retail',
          appChannel: channel,
        },
      })
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
      appChannel: user.appChannel,
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
      appChannel: u.appChannel,
    }
  }
}
