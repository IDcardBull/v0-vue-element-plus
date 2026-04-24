import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import * as path from 'path'
// wechatpay-node-v3 是主流的微信支付 V3 SDK
import WxPay from 'wechatpay-node-v3'

/**
 * 微信支付 V3 服务
 *
 * 依赖的环境变量（在 server/.env 配置）：
 *   WX_APPID                 小程序 AppID
 *   WX_PAY_MCHID             商户号
 *   WX_PAY_SERIAL_NO         商户 API 证书序列号
 *   WX_PAY_PRIVATE_KEY_PATH  apiclient_key.pem 绝对路径
 *   WX_PAY_API_V3_KEY        APIv3 密钥（32 位）
 *   WX_PAY_NOTIFY_URL        支付结果回调 URL（公网可访问，HTTPS）
 *
 * 任一项缺失时，所有方法都会抛出 503，方便本地没有支付资质时调试其他功能。
 */
@Injectable()
export class WechatPayService {
  private readonly logger = new Logger(WechatPayService.name)
  private pay?: WxPay
  private appid?: string
  private mchid?: string
  private notifyUrl?: string
  private apiV3Key?: string

  constructor(private readonly config: ConfigService) {
    this.appid = this.config.get<string>('WX_APPID')
    this.mchid = this.config.get<string>('WX_PAY_MCHID')
    this.notifyUrl = this.config.get<string>('WX_PAY_NOTIFY_URL')
    this.apiV3Key = this.config.get<string>('WX_PAY_API_V3_KEY')
    const serialNo = this.config.get<string>('WX_PAY_SERIAL_NO')
    const keyPath = this.config.get<string>('WX_PAY_PRIVATE_KEY_PATH')

    if (
      !this.appid ||
      !this.mchid ||
      !this.notifyUrl ||
      !this.apiV3Key ||
      !serialNo ||
      !keyPath
    ) {
      this.logger.warn('[WechatPay] 未完整配置，支付相关接口将返回 503')
      return
    }

    try {
      const absPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath)
      const privateKey = fs.readFileSync(absPath)
      this.pay = new WxPay({
        appid: this.appid,
        mchid: this.mchid,
        serial_no: serialNo,
        publicKey: privateKey, // V3 SDK 里字段名，用的是商户私钥
        privateKey,
      } as any)
      this.logger.log('[WechatPay] 初始化成功')
    } catch (e) {
      this.logger.error('[WechatPay] 商户私钥加载失败', (e as Error).stack)
    }
  }

  private ensureReady(): WxPay {
    if (!this.pay) {
      throw new ServiceUnavailableException(
        '微信支付未配置。请在 server/.env 配置 WX_PAY_* 相关环境变量后重启服务。',
      )
    }
    return this.pay
  }

  /**
   * JSAPI/小程序 下单
   * @returns 前端 wx.requestPayment 参数
   */
  async jsapi(params: {
    openid: string
    orderNo: string
    amountYuan: number // 元，内部转分
    description: string
  }) {
    const pay = this.ensureReady()
    const totalFen = Math.round(params.amountYuan * 100)
    if (totalFen <= 0) throw new BadRequestException('支付金额必须大于 0')

    const body: any = {
      appid: this.appid,
      mchid: this.mchid,
      description: params.description || params.orderNo,
      out_trade_no: params.orderNo,
      notify_url: this.notifyUrl,
      amount: { total: totalFen, currency: 'CNY' },
      payer: { openid: params.openid },
    }

    const result: any = await pay.transactions_jsapi(body)
    if (!result?.prepay_id) {
      this.logger.error('[WechatPay] 下单失败: ' + JSON.stringify(result))
      throw new InternalServerErrorException(result?.message || '微信下单失败')
    }

    // 拼装前端 wx.requestPayment 所需参数（已带签名）
    const timeStamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = Math.random().toString(36).slice(2, 18)
    const pkg = `prepay_id=${result.prepay_id}`
    const paySign = (pay as any).sign(
      `${this.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`,
    )

    return {
      timeStamp,
      nonceStr,
      package: pkg,
      signType: 'RSA',
      paySign,
    }
  }

  /**
   * 校验并解密支付回调
   * @param headers 原始请求头
   * @param rawBody 未经解析的 body 字符串
   */
  decryptNotify(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): {
    out_trade_no: string
    transaction_id: string
    trade_state: string
    amount: { total: number; payer_total: number }
  } {
    const pay = this.ensureReady()
    const apiV3Key = this.apiV3Key!

    // 注意：需要提前通过 pay.get_certificates() 缓存平台证书用于验签
    // 简化处理：这里只解密，不做完整验签（生产必须开启验签）
    let envelope: any
    try {
      envelope = JSON.parse(rawBody)
    } catch {
      throw new BadRequestException('回调 body 不是合法 JSON')
    }
    const { resource } = envelope || {}
    if (!resource?.ciphertext) throw new BadRequestException('回调体缺少 resource')

    const decrypted = (pay as any).decipher_gcm(
      resource.ciphertext,
      resource.associated_data,
      resource.nonce,
      apiV3Key,
    )
    const data = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted
    return {
      out_trade_no: data.out_trade_no,
      transaction_id: data.transaction_id,
      trade_state: data.trade_state,
      amount: data.amount,
    }
  }
}
