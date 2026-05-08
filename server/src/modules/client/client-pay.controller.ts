import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'
import { Public } from '@/common/decorators/public.decorator'
import { PrismaService } from '@/common/prisma.service'
import { OrderService } from '../order/order.service'
import { WechatPayService } from './wechat-pay.service'

@Controller('client/pay')
export class ClientPayController {
  private readonly logger = new Logger(ClientPayController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderSvc: OrderService,
    private readonly wxpay: WechatPayService,
  ) {}

  /**
   * 对指定订单发起微信支付
   * 前端拿返回的 { timeStamp, nonceStr, package, signType, paySign } 直接喂给 wx.requestPayment
   */
  @Post('orders/:id')
  async pay(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (user.userType !== 'client') throw new ForbiddenException('仅小程序用户可支付')

    const order = await this.orderSvc.findById(id)
    if (order.userId !== user.sub) throw new NotFoundException('订单不存在')
    if (order.status !== 'pending_pay')
      throw new BadRequestException('订单当前状态不可支付')

    const u = await this.prisma.user.findUnique({ where: { id: user.sub } })
    if (!u?.openid)
      throw new BadRequestException('用户缺少 openid，需先通过微信登录')

    // 用户登录时记录的 appChannel 决定下单时给微信传哪个 AppID。
    // 注意：openid 是按 AppID 隔离的，零售小程序 openid 不能用批发 AppID 下单（反之亦然），
    // 否则会触发 APPID_MCHID_NOT_MATCH 或 OPENID_NOT_BELONG_TO_APPID。
    const channel = (u.appChannel === 'wholesale' ? 'wholesale' : 'retail') as
      | 'retail'
      | 'wholesale'

    return this.wxpay.jsapi({
      openid: u.openid,
      orderNo: order.orderNo,
      amountYuan: Number(order.totalAmount),
      description: `订单 ${order.orderNo}`,
      channel,
    })
  }

  /**
   * 微信支付结果回调
   * - 无需登录（微信服务器直接调用），使用 @Public
   * - 使用 @Res 绕过 ResponseInterceptor，直接按微信规范返回
   * - 需要原始 body（rawBody）用于验签/解密
   */
  @Public()
  @Post('notify')
  async notify(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const rawBody = req.rawBody?.toString('utf8') || ''
    try {
      const result = this.wxpay.decryptNotify(req.headers, rawBody)
      this.logger.log(`[WxPay] 回调 ${result.out_trade_no} → ${result.trade_state}`)

      if (result.trade_state === 'SUCCESS') {
        // 订单号 → id
        const order = await this.prisma.order.findUnique({
          where: { orderNo: result.out_trade_no },
        })
        if (order && order.status === 'pending_pay') {
          await this.orderSvc.markPaid(order.id, result.transaction_id)
        }
      }
      // 微信要求 200 + 固定 JSON
      res.status(200).json({ code: 'SUCCESS', message: '成功' })
    } catch (e) {
      this.logger.error('[WxPay] 回调处理失败', (e as Error).stack)
      res.status(500).json({ code: 'FAIL', message: (e as Error).message })
    }
  }
}
