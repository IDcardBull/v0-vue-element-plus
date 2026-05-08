import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

/**
 * 零售客户（C 端会员）后端服务
 * 数据源：prisma.user where role='retail' 或 appChannel='retail'
 *
 * 前端 src/views/user/CustomerList.vue 期望的 list item 字段：
 *   id, memberId, avatar, nickname, phone, gender(male/female/unknown),
 *   level(V0..V4), tags[], totalAmount, orderCount, points, region,
 *   createdAt, lastActive
 *
 * 数据库 schema users 表只有 levelId（关联 user_levels），所以用 level.code
 * 映射成 V0..V4；累计消费走 totalSpent，订单数实时聚合 order 表。
 */
@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────── 内部映射 ───────────────────
  private mapGender(g?: number | null): 'male' | 'female' | 'unknown' {
    if (g === 1) return 'male'
    if (g === 2) return 'female'
    return 'unknown'
  }

  private mapLevelCode(level?: { code?: string | null; name?: string | null } | null): string {
    if (!level) return 'V0'
    const code = (level.code || '').toUpperCase()
    if (/^V[0-4]$/.test(code)) return code
    // 兼容 name 含数字的情况
    const m = (level.name || '').match(/(\d)/)
    return m ? `V${m[1]}` : 'V0'
  }

  /** 把 prisma 拉到的 user 行 + 聚合数据组装成前端格式 */
  private buildItem(u: any, orderCount: number, lastOrderAt?: Date | null) {
    return {
      id: u.id,
      memberId: `M${String(u.id).padStart(8, '0')}`,
      avatar: u.avatar || '',
      nickname: u.nickname || '匿名用户',
      phone: u.phone || '',
      gender: this.mapGender(u.gender),
      level: this.mapLevelCode(u.level),
      levelName: u.level?.name || '普通会员',
      tags: this.computeTags(u, orderCount),
      totalAmount: Number(u.totalSpent || 0),
      orderCount,
      points: Number(u.points || 0),
      region: '', // schema 里没有 user.region 字段，详情时从最近收件地址取
      createdAt: u.registeredAt
        ? new Date(u.registeredAt).toISOString().replace('T', ' ').slice(0, 19)
        : '',
      lastActive: u.lastActiveAt
        ? new Date(u.lastActiveAt).toISOString().replace('T', ' ').slice(0, 19)
        : (lastOrderAt
          ? new Date(lastOrderAt).toISOString().replace('T', ' ').slice(0, 19)
          : ''),
      status: u.status, // 1 启用 / 0 禁用
      appChannel: u.appChannel,
      role: u.role,
    }
  }

  /** 极简标签计算：根据消费金额 + 最近活跃推断 */
  private computeTags(u: any, orderCount: number): string[] {
    const tags: string[] = []
    const total = Number(u.totalSpent || 0)
    if (total >= 5000) tags.push('高价值')
    if (orderCount >= 5) tags.push('复购')
    const last = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0
    const days = last ? (Date.now() - last) / 86400000 : 999
    if (days <= 7) tags.push('活跃')
    else if (days >= 60 && days < 180) tags.push('沉默')
    else if (days >= 180) tags.push('流失预警')
    return tags
  }

  // ─────────────────── 查询 ───────────────────
  async findAll(query: {
    page?: number
    pageSize?: number
    keyword?: string
    level?: string
    gender?: string
    appChannel?: string
  }) {
    const page = Number(query.page) || 1
    const pageSize = Math.min(Number(query.pageSize) || 20, 200)

    const where: any = {
      // 只查零售会员，dealer/批发用户走 distributor 模块
      role: 'retail',
    }

    if (query.appChannel) where.appChannel = query.appChannel

    if (query.keyword) {
      const kw = query.keyword.trim()
      where.OR = [
        { nickname: { contains: kw } },
        { phone: { contains: kw } },
      ]
    }

    if (query.level) {
      // V0..V4 反查 level
      where.level = { code: query.level }
    }

    if (query.gender) {
      where.gender = query.gender === 'male' ? 1 : query.gender === 'female' ? 2 : null
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { level: true },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ])

    // 聚合订单数 + 最近下单时间（一条 groupBy SQL，比 N+1 快）
    const userIds = users.map((u: any) => u.id)
    const orderAgg = userIds.length
      ? await this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _count: { _all: true },
        _max: { createdAt: true },
      })
      : []
    const aggMap = new Map<number, { count: number; lastAt: Date | null }>()
    for (const a of orderAgg) {
      aggMap.set(Number(a.userId), {
        count: a._count._all,
        lastAt: a._max.createdAt as any,
      })
    }

    return {
      list: users.map((u: any) => {
        const a = aggMap.get(u.id) || { count: 0, lastAt: null }
        return this.buildItem(u, a.count, a.lastAt)
      }),
      total,
      page,
      pageSize,
    }
  }

  async findById(id: number) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        level: true,
        addresses: { orderBy: { id: 'desc' }, take: 1 },
      },
    })
    if (!u) throw new NotFoundException('用户不存在')

    const [orderCount, lastOrder, recent] = await Promise.all([
      this.prisma.order.count({ where: { userId: id } }),
      this.prisma.order.findFirst({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { items: { take: 1 } },
      }),
    ])

    const item = this.buildItem(u, orderCount, lastOrder?.createdAt)
    const addr = u.addresses?.[0]
    if (addr) {
      item.region = [addr.province, addr.city].filter(Boolean).join(' ')
    }

    // 详情多带最近 3 笔订单
    return {
      ...item,
      // 同时返回 status (中文) + statusType (el-tag type)，前端表格直接 v-bind 使用
      recentOrders: recent.map((o: any) => {
        const map: Record<string, { text: string; type: string }> = {
          pending_pay: { text: '待付款', type: 'warning' },
          pending_ship: { text: '待发货', type: 'info' },
          shipped: { text: '已发货', type: 'primary' },
          completed: { text: '已完成', type: 'success' },
          closed: { text: '已关闭', type: 'info' },
          after_sale: { text: '售后中', type: 'warning' },
          refunded: { text: '已退款', type: 'danger' },
        }
        const m = map[o.status] || { text: o.status, type: 'info' }
        return {
          orderNo: o.orderNo,
          product: o.items?.[0]?.productName
            ? `${o.items[0].productName}${o.items.length > 1 ? ` 等 ${o.items.length} 件` : ''}`
            : '',
          amount: Number(o.totalAmount).toFixed(2),
          status: m.text,
          statusType: m.type,
        }
      }),
    }
  }

  /** 后台仅允许改：等级 / 启用状态 / 调分（积分增量）；不允许改手机号、openid */
  async update(id: number, body: any) {
    const u = await this.prisma.user.findUnique({ where: { id } })
    if (!u) throw new NotFoundException('用户不存在')

    const data: any = {}
    if (body.levelId !== undefined && body.levelId !== null && body.levelId !== '') {
      data.levelId = Number(body.levelId)
    }
    if (typeof body.status === 'number') {
      data.status = body.status
    } else if (body.status === 'inactive' || body.status === 'disabled') {
      data.status = 0
    } else if (body.status === 'active') {
      data.status = 1
    }
    // pointsDelta：正数加，负数减；这里事务防并发
    if (body.pointsDelta !== undefined && Number(body.pointsDelta) !== 0) {
      const delta = Math.trunc(Number(body.pointsDelta))
      const updated = await this.prisma.user.update({
        where: { id },
        data: { points: { increment: delta }, ...data },
        include: { level: true },
      })
      return this.buildItem(updated, 0, null)
    }
    if (Object.keys(data).length === 0) {
      // 没有任何字段变更，直接返当前值
      return this.findById(id)
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: { level: true },
    })
    return this.buildItem(updated, 0, null)
  }

  /**
   * 客户管理首屏 4 张统计卡：
   * - total       零售客户总数（角色=retail 不分启用状态）
   * - newThisMonth 本月新注册数（createdAt >= 当月 1 号 0 点）
   * - paid        历史下过单的客户数（distinct userId 在 order 表）
   * - paidRate    转化率 = paid / total * 100
   * - avgOrder    所有零售订单的客单价（completed/shipped/pending_ship 都算
   *               已确认收入；不含 closed/refunded/pending_pay）
   * - avgOrderPrev 上月同口径，环比用
   * - avgOrderTrend  上述两值的环比百分比，正数=增长
   * - active30    最近 30 天有过下单行为的客户数
   * - activeRate  active30 / total * 100
   */
  async getStats() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const REVENUE_STATUSES = ['completed', 'shipped', 'pending_ship']

    const [total, newThisMonth, paidGroup, monthAvgRows, lastMonthAvgRows, activeGroup] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'retail' } }),
        this.prisma.user.count({
          where: { role: 'retail', createdAt: { gte: monthStart } },
        }),
        // 历史下过单的客户去重：按 userId groupBy 后取数组长度
        this.prisma.order.groupBy({
          by: ['userId'],
          where: { channel: 'retail', userId: { not: null } },
          _count: { _all: true },
        }),
        // 本月客单价
        this.prisma.order.aggregate({
          where: {
            channel: 'retail',
            status: { in: REVENUE_STATUSES },
            createdAt: { gte: monthStart },
          },
          _avg: { totalAmount: true },
        }),
        // 上月客单价（环比基线）
        this.prisma.order.aggregate({
          where: {
            channel: 'retail',
            status: { in: REVENUE_STATUSES },
            createdAt: { gte: lastMonthStart, lt: monthStart },
          },
          _avg: { totalAmount: true },
        }),
        // 30 天内活跃用户：order 表中 createdAt>30天前 的 distinct userId
        this.prisma.order.groupBy({
          by: ['userId'],
          where: {
            channel: 'retail',
            userId: { not: null },
            createdAt: { gte: day30Ago },
          },
        }),
      ])

    const paid = paidGroup.length
    const active = activeGroup.length
    const avgOrder = Math.round(Number(monthAvgRows._avg.totalAmount || 0))
    const avgOrderPrev = Math.round(Number(lastMonthAvgRows._avg.totalAmount || 0))

    let avgOrderTrend: number | null = null
    if (avgOrderPrev > 0) {
      avgOrderTrend = Number((((avgOrder - avgOrderPrev) / avgOrderPrev) * 100).toFixed(1))
    }

    return {
      total,
      newThisMonth,
      paid,
      paidRate: total > 0 ? Number(((paid / total) * 100).toFixed(1)) : 0,
      avgOrder,
      avgOrderPrev,
      avgOrderTrend, // 可能为 null（上月无数据无法环比）
      active: active,
      activeRate: total > 0 ? Number(((active / total) * 100).toFixed(1)) : 0,
    }
  }
}
