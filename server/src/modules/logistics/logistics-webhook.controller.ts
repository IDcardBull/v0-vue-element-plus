import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { Public } from '@/common/decorators/public.decorator'
import {
  Kuaidi100Service,
  Kuaidi100TrackItem,
} from './kuaidi100.service'

/**
 * 快递100 Webhook 推送固定应答（无论业务处理是否成功都必须返回，否则 KD100 会持续重试）
 */
const KD100_ACK = {
  result: true,
  returnCode: '200',
  message: '成功',
}

/**
 * 快递100 推送过来的 form 数据结构
 *  Content-Type: application/x-www-form-urlencoded
 *  param: 一段 URL Encode 过的 JSON 字符串（NestJS 默认 body-parser 已自动解码）
 *  sign:  对原始 param 字符串做 MD5(param + key + customer).toUpperCase() 的结果
 */
interface Kuaidi100PushBody {
  param?: string
  sign?: string
}

/**
 * 推送 param JSON 反序列化后的关键字段
 *
 * 文档参考：https://api.kuaidi100.com/document/  --> 订阅推送
 */
interface Kuaidi100PushPayload {
  /** 业务状态码：0=正常 1=订阅失败 2=超时 3=刷新单号 */
  status?: string
  /** 状态说明 */
  message?: string
  /** 物流业务节点；常见值：在途/已签收/退签/转寄/疑难/拒收 等 */
  lastResult?: {
    message?: string
    nu?: string
    com?: string
    state?: string
    /** 0=在途 1=揽件 2=疑难 3=签收 4=退签 5=同城派送 6=同城派送失败 7=拒签 */
    status?: string
    ischeck?: string
    data?: Kuaidi100TrackItem[]
  }
  /** 单号 */
  billstatus?: string
  [k: string]: any
}

@Controller('kuaidi100')
export class LogisticsWebhookController {
  private readonly logger = new Logger(LogisticsWebhookController.name)

  constructor(private readonly kd100: Kuaidi100Service) {}

  /**
   * 接收快递100物流轨迹变更推送
   *
   *   POST /api/kuaidi100/callback
   *   Content-Type: application/x-www-form-urlencoded
   *   body: param=<urlencoded JSON>&sign=<MD5 大写>
   *
   * 流程：
   *  1. 提取 form 字段 param / sign（NestJS 默认 body-parser 已对外层 form 做了 URL 解码，
   *     所以 body.param 就是反 URL Encode 后的 JSON 字符串，可以直接做签名 + JSON.parse）
   *  2. 用 Service 的 verifySign 重算 MD5 校验 sign，不通过直接抛 401
   *  3. JSON.parse(param) 拿到推送 payload，分发到内部业务（更新订单轨迹/状态）
   *  4. 不论业务是否抛异常，都必须给 KD100 返回固定 ACK，否则会反复重试
   */
  @Public()
  @Post('callback')
  @HttpCode(200)
  async handleKuaidi100Callback(@Body() body: Kuaidi100PushBody) {
    const param = (body?.param || '').toString()
    const sign = (body?.sign || '').toString()

    if (!param || !sign) {
      this.logger.warn('[Kuaidi100][Webhook] 缺少 param 或 sign')
      throw new BadRequestException('缺少 param 或 sign')
    }

    // 1) 签名校验（必须用原始未反序列化的 param 字符串）
    if (!this.kd100.verifySign(param, sign)) {
      this.logger.warn(
        `[Kuaidi100][Webhook] 签名不一致，疑似伪造请求；sign=${sign}`,
      )
      throw new UnauthorizedException('快递100 推送签名校验失败')
    }

    // 2) 解析 JSON
    let payload: Kuaidi100PushPayload
    try {
      payload = JSON.parse(param)
    } catch (err: any) {
      this.logger.error(
        `[Kuaidi100][Webhook] param JSON 解析失败: ${err?.message}`,
      )
      throw new BadRequestException('param 不是合法 JSON')
    }

    // 3) 派发业务处理；任何异常都吞掉只记日志，保证下面统一 ACK
    try {
      await this.dispatch(payload)
    } catch (err: any) {
      this.logger.error(
        `[Kuaidi100][Webhook] 业务处理异常（已吞，仍按成功 ACK）: ${err?.message}`,
        err?.stack,
      )
    }

    // 4) 严格按 KD100 文档要求的应答格式返回，否则会被重试
    return KD100_ACK
  }

  /**
   * 内部派发：把推送 payload 交给真正的业务模块（更新订单轨迹/状态、推企业微信群等）
   *
   * TODO: 接入 OrderService.applyKuaidi100Push(payload) 之后，把 lastResult.data
   *       写到订单的物流轨迹表，并按 lastResult.state / status 推动订单状态机：
   *         - "3" 已签收 -> 自动确认收货 / 标记为 completed
   *         - "4" 退签 / "7" 拒签 -> 触发退款流程
   */
  private async dispatch(payload: Kuaidi100PushPayload): Promise<void> {
    const lr = payload?.lastResult
    const num = lr?.nu || ''
    const com = lr?.com || ''
    const state = lr?.state || lr?.status || ''
    const tracks = Array.isArray(lr?.data) ? lr!.data!.length : 0

    this.logger.log(
      `[Kuaidi100][Webhook] 收到推送 com=${com} num=${num} state=${state} tracks=${tracks} status=${payload?.status}`,
    )

    // 此处先打日志占位，等 OrderModule 暴露写库方法后再 wire 起来
  }
}
