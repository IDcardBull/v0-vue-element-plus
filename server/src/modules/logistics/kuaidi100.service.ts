import { HttpService } from '@nestjs/axios'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { firstValueFrom } from 'rxjs'

/**
 * 快递100 API 客户端封装
 *
 * 接入文档（实时查询/订阅推送 etc.）:
 *   https://api.kuaidi100.com/document/
 *
 * 鉴权方式：客户端将 customer + key 配置在服务端，按 KD100 规则生成 sign
 *   sign = MD5( JSON.stringify(param) + key + customer ).toUpperCase()
 *
 * 请求格式：application/x-www-form-urlencoded，body 三字段：
 *   - customer: 客户编号（不参与 sign 字符串拼接以外的明文展示）
 *   - sign:     上述 MD5
 *   - param:    与 sign 入参完全一致的 JSON 字符串（注意：必须是同一个字符串实例！）
 */
@Injectable()
export class Kuaidi100Service {
  private readonly logger = new Logger(Kuaidi100Service.name)

  // 实时查询接口（customer + sign + param）
  static readonly POLL_QUERY_URL = 'https://poll.kuaidi100.com/poll/query.do'
  // 订阅接口（schema=json + param 内含 key，无 sign）
  static readonly POLL_SUBSCRIBE_URL = 'https://poll.kuaidi100.com/poll'

  // 兼容旧引用
  static readonly POLL_URL = Kuaidi100Service.POLL_QUERY_URL

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /** 是否已经把 customer / key 配齐 */
  isEnabled(): boolean {
    return Boolean(this.getCustomer() && this.getKey())
  }

  private getCustomer(): string {
    return (this.config.get<string>('KUAIDI100_CUSTOMER') || '').trim()
  }

  private getKey(): string {
    return (this.config.get<string>('KUAIDI100_KEY') || '').trim()
  }

  /**
   * 快递100 专用签名
   *  sign = MD5( param + key + customer ).toUpperCase()
   *  注意：传入的 param **必须**是即将作为 form body 发送的同一份字符串。
   */
  private generateSign(param: string): string {
    const key = this.getKey()
    const customer = this.getCustomer()
    return crypto
      .createHash('md5')
      .update(param + key + customer, 'utf8')
      .digest('hex')
      .toUpperCase()
  }

  /**
   * 校验快递100 Webhook 推送的 sign。
   * 用同样的算法重算一次再做大小写无关比较，调用方应在 Webhook 入口第一时间调用。
   *
   * @param param 推送上来的、未经反序列化的原始 JSON 字符串
   * @param sign  推送上来的 sign
   */
  verifySign(param: string, sign: string): boolean {
    if (!this.isEnabled()) return false
    if (!param || !sign) return false
    const expected = this.generateSign(param)
    return expected.toUpperCase() === String(sign).toUpperCase()
  }

  /**
   * 通用 POST 请求。所有业务 API（实时查询、订阅、面单等）都共用这个签名 + 表单结构。
   * 调用方传入 param 对象即可，方法内部会负责：
   *   1. 把 param 序列化成同一份字符串
   *   2. 用同一份字符串生成 sign
   *   3. 用 application/x-www-form-urlencoded 发送 customer/sign/param 三字段
   *
   * 注意：JSON.stringify 一次后，把字符串原样既作为签名输入也作为表单值，避免
   * 因 key 顺序、空白差异导致签名与服务端不一致。
   */
  private async sendRequest<T = any>(url: string, param: object): Promise<T> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        '快递100 未配置（KUAIDI100_CUSTOMER / KUAIDI100_KEY）',
      )
    }

    const paramStr = JSON.stringify(param)
    const sign = this.generateSign(paramStr)

    const body = new URLSearchParams()
    body.append('customer', this.getCustomer())
    body.append('sign', sign)
    body.append('param', paramStr)

    try {
      const { data } = await firstValueFrom(
        this.http.post<T>(url, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          // 快递100 偶发延迟，给个相对宽松的超时
          timeout: 10_000,
        }),
      )
      return data
    } catch (err: any) {
      this.logger.error(
        `[Kuaidi100] POST ${url} 失败: ${err?.message || err}`,
        err?.stack,
      )
      throw err
    }
  }

  /**
   * 订阅接口专用 POST：body = schema=json & param={...}（无 customer/sign）
   * key 必须放进 param JSON 的 `key` 字段里，由 KD100 服务端校验。
   */
  private async sendSubscribeRequest<T = Kuaidi100SubscribeResponse>(
    url: string,
    param: object,
  ): Promise<T> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        '快递100 未配置（KUAIDI100_CUSTOMER / KUAIDI100_KEY）',
      )
    }

    const body = new URLSearchParams()
    body.append('schema', 'json')
    body.append('param', JSON.stringify(param))

    try {
      const { data } = await firstValueFrom(
        this.http.post<T>(url, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10_000,
        }),
      )
      return data
    } catch (err: any) {
      this.logger.error(
        `[Kuaidi100] SUBSCRIBE ${url} 失败: ${err?.message || err}`,
        err?.stack,
      )
      throw err
    }
  }

  // ============ 业务方法（在内部复用 sendRequest / sendSubscribeRequest） ============

  /**
   * 实时查询物流轨迹
   *
   * @param com   快递公司编码（如 "shunfeng" / "yuantong"，参考 KD100 文档）
   * @param num   运单号
   * @param phone 收/寄件人手机号后四位（顺丰、丰网、顺心捷达必填）
   * @returns     解析后的物流轨迹数组（按时间倒序）。若快递100返回错误，则抛出异常。
   */
  async queryTrack(params: {
    com: string
    num: string
    phone?: string
  }): Promise<Kuaidi100TrackItem[]> {
    const com = (params.com || '').trim().toLowerCase()
    const num = (params.num || '').trim()
    if (!com || !num) {
      throw new ServiceUnavailableException('com / num 不能为空')
    }

    const res = await this.sendRequest<Kuaidi100QueryResponse>(
      Kuaidi100Service.POLL_QUERY_URL,
      {
        com,
        num,
        phone: params.phone || '',
        resultv2: '4', // 自动签收 + 物流路由
        show: '0', // 0 = 返回 JSON
        order: 'desc', // 按时间倒序
      },
    )

    // KD100 query 失败时 returnCode != 200 或 message != 'ok'
    if (res?.returnCode && res.returnCode !== '200') {
      this.logger.warn(
        `[Kuaidi100] queryTrack 失败: ${res.returnCode} ${res.message}`,
      )
      throw new ServiceUnavailableException(
        `快递100 查询失败: ${res.message || res.returnCode}`,
      )
    }
    if (res?.message && res.message !== 'ok') {
      this.logger.warn(`[Kuaidi100] queryTrack 业务错误: ${res.message}`)
    }
    return Array.isArray(res?.data) ? res.data : []
  }

  /**
   * 订阅物流轨迹更新
   *
   * 订阅成功后，每次轨迹有新节点，KD100 会主动 POST 推送到 callbackurl。
   * 我们这边对应的 webhook 见：POST /api/kuaidi100/callback
   *
   * @param com   快递公司编码（与 KD100 接口字段名 company 等价）
   * @param num   运单号
   * @param phone 手机号后四位（顺丰系必填）
   * @returns     KD100 订阅应答 { result, returnCode, message }
   */
  async subscribeTrack(params: {
    com: string
    num: string
    phone?: string
  }): Promise<Kuaidi100SubscribeResponse> {
    const com = (params.com || '').trim().toLowerCase()
    const num = (params.num || '').trim()
    if (!com || !num) {
      throw new ServiceUnavailableException('com / num 不能为空')
    }

    const callbackUrl =
      this.config.get<string>('KUAIDI100_CALLBACK_URL') ||
      this.buildDefaultCallbackUrl()

    const payload = {
      company: com,
      number: num,
      from: '',
      to: '',
      key: this.getKey(), // 订阅 API 用 key 而不是 sign
      parameters: {
        callbackurl: callbackUrl,
        salt: '', // 可选，KD100 会原样回传，便于验签
        resultv2: '4',
        autoCom: '1',
        interCom: '0',
        phone: params.phone || '',
      },
    }

    const res = await this.sendSubscribeRequest(
      Kuaidi100Service.POLL_SUBSCRIBE_URL,
      payload,
    )

    if (res?.result === false || res?.returnCode !== '200') {
      this.logger.warn(
        `[Kuaidi100] subscribeTrack 失败 com=${com} num=${num}: ${res?.returnCode} ${res?.message}`,
      )
    }
    return res
  }

  /** 优先用配置项 KUAIDI100_CALLBACK_URL，否则基于 APP_BASE_URL 拼默认 webhook */
  private buildDefaultCallbackUrl(): string {
    const base = (this.config.get<string>('APP_BASE_URL') || '').replace(
      /\/+$/,
      '',
    )
    if (!base) {
      throw new ServiceUnavailableException(
        '快递100 订阅缺少 callbackurl，请配置 KUAIDI100_CALLBACK_URL 或 APP_BASE_URL',
      )
    }
    return `${base}/api/kuaidi100/callback`
  }
}

// ============ 响应类型 ============

export interface Kuaidi100TrackItem {
  /** 节点描述 */
  context: string
  /** 节点时间（KD100 原样返回） */
  time: string
  /** 格式化后的时间 */
  ftime: string
  /** 行政区域代码（可选） */
  areaCode?: string
  /** 行政区域名（可选） */
  areaName?: string
  /** 状态码（可选） */
  status?: string
  /** 物流公司全称（可选） */
  statusCode?: string
  [k: string]: any
}

export interface Kuaidi100QueryResponse {
  message?: string
  nu?: string
  ischeck?: string
  com?: string
  /** "0"=在途 "1"=揽收 "2"=疑难 "3"=签收 "4"=退签 ... */
  state?: string
  status?: string
  condition?: string
  returnCode?: string
  data?: Kuaidi100TrackItem[]
  [k: string]: any
}

export interface Kuaidi100SubscribeResponse {
  result?: boolean
  returnCode?: string
  message?: string
  [k: string]: any
}
