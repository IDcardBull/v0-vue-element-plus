import {
  Controller,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  Res,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Public } from '@/common/decorators/public.decorator'
import { PrismaService } from '@/common/prisma.service'
import { OrderService } from '../order/order.service'
import { WechatPayService } from './wechat-pay.service'

/**
 * 微信支付（V3）异步回调专用 Controller。
 *
 * 路由：POST /api/wechat/pay-callback
 *
 * 职责：
 *   1. 取出 Wechatpay-Signature / Timestamp / Nonce / Serial 头部并验签；
 *   2. 用 APIv3Key 解密 resource.ciphertext，拿到 out_trade_no / trade_state / transaction_id；
 *   3. 严格按 {"code":"SUCCESS","message":"成功"} + HTTP 200 应答，否则微信会反复重试。
 *
 * 说明：
 *   - 使用 @Public 跳过全局 JwtAuthGuard，微信服务器不会带我们自己的 JWT
 *   - 使用 @Res 直接控制响应，绕过 ResponseInterceptor 的统一包装
 *   - 用 RawBodyRequest 拿到未经解析的 body 字符串，验签和解密都需要原始字节
 */
@Controller('wechat')
export class WechatPayNotifyController {
  private readonly logger = new Logger(WechatPayNotifyController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderSvc: OrderService,
    private readonly wxpay: WechatPayService,
  ) {}

  @Public()
  @Post('pay-callback')
  @HttpCode(200)
  async payCallback(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const rawBody = req.rawBody?.toString('utf8') || ''

    try {
      // === 1. 验签 + 解密 ===
      // verifyAndDecryptNotify 内部会：
      //   - 从 Wechatpay-Serial 拉对应平台证书的公钥
      //   - 用 timestamp\n + nonce\n + rawBody\n 做 RSA-SHA256 校验
      //   - APIv3Key 走 AES-256-GCM 解密 resource.ciphertext
      //   - 校验 timestamp 与服务器偏差 ≤5 分钟，防重放
      const result = await this.wxpay.verifyAndDecryptNotify(req.headers, rawBody)

      this.logger.log(
        `[WxPayNotify] out_trade_no=${result.out_trade_no} trade_state=${result.trade_state} tx=${result.transaction_id}`,
      )

      // 非 SUCCESS（USERPAYING / REFUND / CLOSED 等）直接 ack 即可，不更新订单
      if (result.trade_state !== 'SUCCESS') {
        return this.ack(res)
      }

      // === 2. 幂等更新订单状态 ===
      //
      // ⚠️ 关于幂等：
      //
      //   微信会因为网络抖动、重试策略等原因，对同一笔订单**多次推送**回调；
      //   并发场景下可能两条 Notify 同时到达（不同进程 / 同进程多个 worker）。
      //   下面的写法依赖以下三个屏障保证幂等，缺一不可：
      //
      //   A. 先 findUnique({ orderNo }) 拿订单，只有 status === 'pending_pay' 才走更新；
      //      再次回调进来时 status 已是 pending_ship/shipped，直接 ack。
      //   B. orderSvc.markPaid 内部使用 `prisma.order.update`：DB 主键唯一约束 + 事务，
      //      如果两个请求同时进入 if 分支，最终 update 也只会成功一次（另一次会再读到
      //      已支付状态、再走 A 分支）。如果你要更严格，可改成
      //         `prisma.order.updateMany({ where:{ id, status:'pending_pay' }, data:{...} })`
      //      用 affectedRows>0 决定是否触发后续动作（如发券、发企微通知）。
      //   C. **任何**异常（包括 markPaid 抛错）我们都吞掉只 log，不要把 5xx 抛回微信，
      //      否则微信会按指数退避**反复重试**，反而放大并发压力。本次失败可以等下一次
      //      微信重推 + 我们的对账定时任务来收敛。
      //
      //   另外：如果业务上还要做"必须是同一笔金额才入账"，请在这里加
      //   `if (BigInt(result.amount.total) !== order.totalAmountFen) return ack;`
      //
      const order = await this.prisma.order.findUnique({
        where: { orderNo: result.out_trade_no },
      })
      if (!order) {
        // 订单已被取消/不存在：幂等返回成功，避免微信无限重试
        this.logger.warn(
          `[WxPayNotify] 订单不存在或已删除: ${result.out_trade_no}`,
        )
        return this.ack(res)
      }
      if (order.status === 'pending_pay') {
        try {
          await this.orderSvc.markPaid(order.id, result.transaction_id)
        } catch (err: any) {
          // 极端并发：另一条回调先一步把状态改成 pending_ship，markPaid 抛异常
          // 这是预期内的幂等触发，记 warn 并继续 ack
          this.logger.warn(
            `[WxPayNotify] markPaid 触发幂等冲突: ${err?.message || err}`,
          )
        }
      } else {
        this.logger.log(
          `[WxPayNotify] 订单 ${order.orderNo} 当前状态=${order.status}，跳过 markPaid`,
        )
      }

      return this.ack(res)
    } catch (err: any) {
      // 验签失败 / 解密失败 / 平台证书加载失败：返回 5xx，让微信稍后重试
      // （这种通常是配置问题，不要静默吞掉）
      this.logger.error(
        `[WxPayNotify] 处理失败: ${err?.message || err}`,
        err?.stack,
      )
      return res
        .status(401)
        .json({ code: 'FAIL', message: err?.message || '验签失败' })
    }
  }

  /** 微信规范要求的成功应答：HTTP 200 + 固定 JSON */
  private ack(res: Response) {
    return res.status(200).json({ code: 'SUCCESS', message: '成功' })
  }
}
