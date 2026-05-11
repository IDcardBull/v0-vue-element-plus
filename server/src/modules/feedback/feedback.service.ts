import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'
import { SettingService } from '../setting/setting.service'

export interface FeedbackInput {
  type?: string | null
  orderCode?: string | null
  content?: string | null
  contact?: string | null
  images?: string[] | null
}

const TYPE_LABELS: Record<string, string> = {
  aftersale: '售后',
  consult: '咨询',
  feedback: '建议',
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingSvc: SettingService,
  ) {}

  async create(input: FeedbackInput, userId?: number | null) {
    const content = String(input.content || '').trim().slice(0, 1000)
    const contact = String(input.contact || '').trim().slice(0, 128)
    if (!content) throw new Error('内容不能为空')
    if (!contact) throw new Error('请填写联络方式')
    const type = String(input.type || 'aftersale').slice(0, 32)
    const orderCode = String(input.orderCode || '').trim().slice(0, 64)
    const images = Array.isArray(input.images)
      ? input.images.filter((u) => typeof u === 'string').slice(0, 6)
      : []

    const fb = await this.prisma.feedback.create({
      data: {
        type,
        orderCode,
        content,
        contact,
        images: images as any,
        userId: userId ?? null,
      },
    })

    // 异步转发到企业微信，不阻塞响应
    this.forwardToWework(fb.id, { type, orderCode, content, contact, images }).catch((err) => {
      this.logger.warn(`转发企业微信失败 #${fb.id}: ${err?.message || err}`)
    })

    return { id: fb.id, ok: true }
  }

  async list(params: { page?: number; pageSize?: number; type?: string } = {}) {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20))
    const where: any = {}
    if (params.type) where.type = params.type
    const [list, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.feedback.count({ where }),
    ])
    return { list, total, page, pageSize }
  }

  private async forwardToWework(
    fbId: number,
    payload: { type: string; orderCode: string; content: string; contact: string; images: string[] },
  ) {
    const url = (await this.settingSvc.getValue('wework_bot_url')) || ''
    if (!url || !/^https?:\/\//.test(url)) {
      this.logger.log(`未配置 wework_bot_url，跳过转发 (#${fbId})`)
      return
    }
    const typeLabel = TYPE_LABELS[payload.type] || payload.type
    const lines = [
      `**新客服反馈** #${fbId}`,
      `> 类型：<font color="info">${typeLabel}</font>`,
      payload.orderCode ? `> 订单号：${payload.orderCode}` : '',
      `> 联系人：${payload.contact}`,
      '',
      payload.content,
    ].filter(Boolean)
    if (payload.images.length) {
      lines.push('')
      lines.push('凭证：')
      payload.images.forEach((u, i) => lines.push(`[图${i + 1}](${u})`))
    }
    const body = { msgtype: 'markdown', markdown: { content: lines.join('\n') } }
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await resp.text()
    this.logger.log(`企业微信转发 #${fbId} → ${resp.status} ${text.slice(0, 200)}`)
    try {
      await this.prisma.feedback.update({ where: { id: fbId }, data: { forwarded: resp.ok } })
    } catch {}
  }

  /** 测试 webhook 是否可达 */
  async testWework(url?: string) {
    const target = url || (await this.settingSvc.getValue('wework_bot_url')) || ''
    if (!target || !/^https?:\/\//.test(target)) {
      return { ok: false, message: '未配置或 URL 非法' }
    }
    const body = {
      msgtype: 'markdown',
      markdown: { content: '**[测试消息]** 客服反馈通道连通正常 ✅' },
    }
    const resp = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await resp.text()
    return { ok: resp.ok, status: resp.status, response: text.slice(0, 500) }
  }
}
