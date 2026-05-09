import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common'
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator'
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
   * 主动同步支付状态（前端在 wx.requestPayment 成功回调里调用）
   *
   * 业务背景：微信异步 notify 在以下场景常常推不到 / 推迟到达：
   *   - 开发环境 notify_url 不是公网 https
   *   - notify_url 配置错、平台证书过期
   *   - 公网偶发抖动（通常重试，但用户已经站在结果页等结果）
   *
   * 解决：用户付完款一定会回到小程序，前端调一次本接口，后端用商户证书
   * 主动 GET https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/{orderNo}
   * 拿真实 trade_state；为 SUCCESS 就直接 markPaid。这样**不依赖** notify
   * 也能让用户立刻看到"已支付"。
   *
   * 幂等：内部走 markPaid（仅 status=pending_pay 时才更新），
   * 用户多次刷新都不会重复处理。
   */
  @Post('orders/:id/sync')
  async sync(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (user.userType !== 'client') throw new ForbiddenException('仅小程序用户可同步支付')

    const order = await this.orderSvc.findById(id)
    if (order.userId !== user.sub) throw new NotFoundException('订单不存在')

    // 已经是支付后状态：直接返回，避免去微信查询白做一次
    if (order.status !== 'pending_pay') {
      return {
        status: order.status,
        paid: order.status !== 'pending_pay' && order.status !== 'cancelled',
        tradeState: 'SUCCESS',
        message: '订单已处于支付后状态',
      }
    }

    const result = await this.wxpay.queryOrderByOutTradeNo(order.orderNo)
    this.logger.log(
      `[WxPay/Sync] order=${order.orderNo} trade_state=${result.trade_state} tx=${result.transaction_id || ''}`,
    )

    if (result.trade_state === 'SUCCESS') {
      // 二次校验金额（防止极端伪造）
      if (result.amount?.total != null) {
        const expectedFen = Math.round(Number(order.totalAmount) * 100)
        if (Number(result.amount.total) !== expectedFen) {
          this.logger.error(
            `[WxPay/Sync] 金额不一致 order=${order.orderNo} expected=${expectedFen} actual=${result.amount.total}`,
          )
          throw new BadRequestException('支付金额与订单不一致，请联系客服')
        }
      }
      try {
        await this.orderSvc.markPaid(order.id, result.transaction_id)
      } catch (err: any) {
        // 与 notify 并发触发的幂等冲突：忽略
        this.logger.warn(`[WxPay/Sync] markPaid 幂等冲突: ${err?.message || err}`)
      }
      return {
        status: 'pending_ship',
        paid: true,
        tradeState: result.trade_state,
        transactionId: result.transaction_id,
        message: '支付成功',
      }
    }

    // 中间状态：USERPAYING（需轮询）/ NOTPAY（用户未付）/ CLOSED（订单关闭）/ PAYERROR
    return {
      status: order.status,
      paid: false,
      tradeState: result.trade_state,
      tradeStateDesc: result.trade_state_desc,
      message:
        result.trade_state === 'USERPAYING'
          ? '用户支付中，请稍候再试'
          : result.trade_state === 'NOTPAY'
            ? '用户尚未完成支付'
            : result.trade_state_desc || '支付未成功',
    }
  }
}
