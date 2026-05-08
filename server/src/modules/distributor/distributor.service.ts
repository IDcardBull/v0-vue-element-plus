import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { WorkWxService } from '../notify/work-wx.service'

/**
 * 分销商（B 端批发账号）后端服务
 * 数据源：prisma.distributor + 关联 prisma.user
 *
 * 前端 src/views/user/DistributorList.vue 期望字段：
 *   id, code, company_name, contact, phone, province, city, level,
 *   status (pending/approved/rejected/disabled), credit_limit,
 *   used_credit, order_count, total_amount, join_date, last_order_date, remark
 *
 * 注意 level 映射：
 *   schema: normal/silver/gold/diamond
 *   前端:    regular/silver/gold/diamond
 *
 * region 在 schema 是单字段（如 "江苏·宜兴"），前端要 province/city，
 * 这里用 "·" 或空格拆分，回写时拼接。
 */
@Injectable()
export class DistributorService {
  private readonly logger = new Logger(DistributorService.name)

  constructor(
    private prisma: PrismaService,
    private workWx: WorkWxService,
  ) {}

  // ─────────────────── 内部映射 ───────────────────
  /** schema → 前端 level */
  private outLevel(s?: string): string {
    return s === 'normal' ? 'regular' : s || 'regular'
  }
  /** 前端 → schema level */
  private inLevel(s?: string): string {
    if (!s) return 'normal'
    return s === 'regular' ? 'normal' : s
  }

  /** "江苏·宜兴" / "江苏 宜兴" / "江苏宜兴" → { province, city } */
  private splitRegion(region?: string | null): { province: string; city: string } {
    if (!region) return { province: '', city: '' }
    const m = region.split(/[·\s/、,，]+/).filter(Boolean)
    return { province: m[0] || '', city: m[1] || '' }
  }
  private joinRegion(province?: string, city?: string): string {
    return [province, city].filter(Boolean).join('·')
  }

  /** 把 prisma 行 + 聚合数据组装成前端格式 */
  private buildItem(d: any, orderCount: number, totalAmount: number) {
    const { province, city } = this.splitRegion(d.region)
    const fmtDate = (x?: Date | null) =>
      x ? new Date(x).toISOString().slice(0, 10) : ''
    return {
      id: d.id,
      code: `DS${String(d.id).padStart(8, '0')}`,
      company_name: d.companyName,
      contact: d.contactName,
      phone: d.contactPhone,
      province,
      city,
      level: this.outLevel(d.level),
      status: d.auditStatus, // pending/approved/rejected/disabled
      credit_limit: Number(d.creditLimit || 0),
      used_credit: Number(d.creditUsed || 0),
      order_count: orderCount,
      total_amount: totalAmount,
      total_purchase: Number(d.totalPurchase || 0),
      join_date: fmtDate(d.createdAt),
      last_order_date: d.lastOrderAt ? fmtDate(d.lastOrderAt) : '',
      remark: d.auditRemark || '',
      legal_person: d.legalPerson || '',
      business_license: d.businessLicense || '',
      // 关联用户简要信息
      userId: d.userId,
      user: d.user
        ? {
          id: d.user.id,
          nickname: d.user.nickname,
          phone: d.user.phone,
          avatar: d.user.avatar,
        }
        : null,
    }
  }

  // ─────────────────── 查询 ───────────────────
  async findAll(query: {
    page?: number
    pageSize?: number
    keyword?: string
    level?: string
    status?: string
    province?: string
  }) {
    const page = Number(query.page) || 1
    const pageSize = Math.min(Number(query.pageSize) || 20, 200)

    const where: any = {}
    if (query.keyword) {
      const kw = query.keyword.trim()
      where.OR = [
        { companyName: { contains: kw } },
        { contactName: { contains: kw } },
        { contactPhone: { contains: kw } },
      ]
    }
    if (query.level) where.level = this.inLevel(query.level)
    if (query.status) where.auditStatus = query.status
    if (query.province) where.region = { contains: query.province }

    const [list, total] = await Promise.all([
      this.prisma.distributor.findMany({
        where,
        include: {
          user: { select: { id: true, nickname: true, phone: true, avatar: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.distributor.count({ where }),
    ])

    // 聚合每个分销商的订单数 + 总额（按 user_id 聚合 channel='wholesale'）
    const userIds = list.map((d: any) => d.userId)
    const orderAgg = userIds.length
      ? await this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, channel: 'wholesale' },
        _count: { _all: true },
        _sum: { paidAmount: true, totalAmount: true },
      })
      : []
    const aggMap = new Map<number, { count: number; total: number }>()
    for (const a of orderAgg) {
      aggMap.set(Number(a.userId), {
        count: a._count._all,
        // paidAmount 优先，没付款就用 totalAmount（授信单）
        total: Number(a._sum.paidAmount || a._sum.totalAmount || 0),
      })
    }

    return {
      list: list.map((d: any) => {
        const a = aggMap.get(d.userId) || { count: 0, total: 0 }
        return this.buildItem(d, a.count, a.total)
      }),
      total,
      page,
      pageSize,
    }
  }

  async findById(id: number) {
    const d = await this.prisma.distributor.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nickname: true, phone: true, avatar: true } },
      },
    })
    if (!d) throw new NotFoundException('分销商不存在')

    const [orderCount, sumAgg, recent] = await Promise.all([
      this.prisma.order.count({ where: { userId: d.userId, channel: 'wholesale' } }),
      this.prisma.order.aggregate({
        where: { userId: d.userId, channel: 'wholesale' },
        _sum: { paidAmount: true, totalAmount: true },
      }),
      this.prisma.order.findMany({
        where: { userId: d.userId, channel: 'wholesale' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          orderNo: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
          createdAt: true,
        },
      }),
    ])
    const totalAmount = Number(
      sumAgg._sum.paidAmount || sumAgg._sum.totalAmount || 0,
    )

    return {
      ...this.buildItem(d, orderCount, totalAmount),
      recentOrders: recent.map((o: any) => ({
        orderNo: o.orderNo,
        amount: Number(o.paidAmount || o.totalAmount).toFixed(2),
        status: o.status,
        createdAt: o.createdAt
          ? new Date(o.createdAt).toISOString().slice(0, 16).replace('T', ' ')
          : '',
      })),
    }
  }

  // ─────────────────── 更新（编辑/启用禁用/调整授信）───────────────────
  async update(id: number, body: any) {
    const d = await this.prisma.distributor.findUnique({ where: { id } })
    if (!d) throw new NotFoundException('分销商不存在')

    const data: any = {}
    if (body.company_name !== undefined) data.companyName = String(body.company_name).trim()
    if (body.contact !== undefined) data.contactName = String(body.contact).trim()
    if (body.phone !== undefined) {
      const p = String(body.phone).trim()
      if (p && !/^1[3-9]\d{9}$/.test(p)) throw new BadRequestException('手机号格式不正确')
      data.contactPhone = p
    }
    if (body.province !== undefined || body.city !== undefined) {
      data.region = this.joinRegion(
        body.province ?? this.splitRegion(d.region).province,
        body.city ?? this.splitRegion(d.region).city,
      )
    }
    if (body.level !== undefined) data.level = this.inLevel(body.level)
    if (body.credit_limit !== undefined) {
      const lim = Number(body.credit_limit)
      if (!Number.isFinite(lim) || lim < 0) throw new BadRequestException('授信额度必须 ≥ 0')
      // 不能调到比已用还低
      if (lim < Number(d.creditUsed || 0)) {
        throw new BadRequestException(
          `授信额度不能低于已用额度 ¥${Number(d.creditUsed || 0).toLocaleString()}`,
        )
      }
      data.creditLimit = lim
    }
    if (body.remark !== undefined) data.auditRemark = String(body.remark).slice(0, 500)
    // 启用/禁用：单独切 auditStatus
    if (body.status !== undefined) {
      const s = String(body.status)
      if (!['pending', 'approved', 'rejected', 'disabled'].includes(s)) {
        throw new BadRequestException('无效的状态值')
      }
      data.auditStatus = s
    }

    const updated = await this.prisma.distributor.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, nickname: true, phone: true, avatar: true } },
      },
    })
    return this.buildItem(updated, 0, 0)
  }

  // ─────────────────── 审核 ───────────────────
  /**
   * 审核分销商：
   *   pass=true  → auditStatus=approved，user.role='dealer'，发企微通知
   *   pass=false → auditStatus=rejected，user.role 保持 retail，备注必填
   */
  async audit(id: number, pass: boolean, remark: string | undefined, operatorId: number) {
    const d = await this.prisma.distributor.findUnique({
      where: { id },
      include: { user: true },
    })
    if (!d) throw new NotFoundException('分销商不存在')
    if (d.auditStatus === 'approved' && pass) {
      throw new BadRequestException('该分销商已审核通过')
    }
    if (!pass && (!remark || !remark.trim())) {
      throw new BadRequestException('拒绝时必须填写理由')
    }

    const nextStatus = pass ? 'approved' : 'rejected'

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.distributor.update({
        where: { id },
        data: {
          auditStatus: nextStatus,
          auditRemark: remark?.slice(0, 500) || null,
          auditedBy: operatorId || null,
          auditedAt: new Date(),
        },
      })
      // 同步 user.role：通过则升级为 dealer，否则维持 retail
      await tx.user.update({
        where: { id: d.userId },
        data: { role: pass ? 'dealer' : 'retail' },
      })
      return tx.distributor.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, nickname: true, phone: true, avatar: true } },
        },
      })
    })

    // 异步通知企微，失败仅 warn
    this.workWx
      .sendMarkdown(
        pass
          ? `## 分销商审核通过\n\n**${d.companyName}** 已通过审核\n` +
            `> 联系人：${d.contactName} ${d.contactPhone}\n` +
            `> 等级：${this.outLevel(d.level)}\n` +
            `> 初始授信：¥${Number(d.creditLimit).toLocaleString()}`
          : `## 分销商审核驳回\n\n**${d.companyName}** 审核未通过\n` +
            `> 联系人：${d.contactName} ${d.contactPhone}\n` +
            `> 拒绝理由：${remark}`,
      )
      .catch((err) =>
        this.logger.warn(`[Notify] 分销商审核通知失败: ${err?.message || err}`),
      )

    return this.buildItem(updated, 0, 0)
  }

  /**
   * 分销商管理首屏 4 张统计卡：
   * - total           分销商总数
   * - approved        已通过数
   * - pending         待审核数
   * - rejected        驳回数
   * - disabled        已禁用数
   * - totalAmount     全部分销商累计批发订单金额（completed/shipped/pending_ship 计入）
   * - thisMonthAmount 本月批发订单金额（环比展示用）
   * - lastMonthAmount 上月同口径
   * - amountTrend     环比百分比，正数=增长（上月 0 时返回 null）
   */
  async getStats() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const REVENUE_STATUSES = ['completed', 'shipped', 'pending_ship']

    const [
      total,
      approved,
      pending,
      rejected,
      disabled,
      allAmountAgg,
      monthAmountAgg,
      lastMonthAmountAgg,
    ] = await Promise.all([
      this.prisma.distributor.count(),
      this.prisma.distributor.count({ where: { auditStatus: 'approved' } }),
      this.prisma.distributor.count({ where: { auditStatus: 'pending' } }),
      this.prisma.distributor.count({ where: { auditStatus: 'rejected' } }),
      this.prisma.distributor.count({ where: { auditStatus: 'disabled' } }),
      this.prisma.order.aggregate({
        where: { channel: 'wholesale', status: { in: REVENUE_STATUSES } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: {
          channel: 'wholesale',
          status: { in: REVENUE_STATUSES },
          createdAt: { gte: monthStart },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: {
          channel: 'wholesale',
          status: { in: REVENUE_STATUSES },
          createdAt: { gte: lastMonthStart, lt: monthStart },
        },
        _sum: { totalAmount: true },
      }),
    ])

    const totalAmount = Number(allAmountAgg._sum.totalAmount || 0)
    const thisMonthAmount = Number(monthAmountAgg._sum.totalAmount || 0)
    const lastMonthAmount = Number(lastMonthAmountAgg._sum.totalAmount || 0)

    let amountTrend: number | null = null
    if (lastMonthAmount > 0) {
      amountTrend = Number(
        (((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100).toFixed(1),
      )
    }

    return {
      total,
      approved,
      pending,
      rejected,
      disabled,
      totalAmount,
      thisMonthAmount,
      lastMonthAmount,
      amountTrend,
    }
  }
}
