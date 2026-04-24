import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const [
      productCount,
      skuCount,
      retailCustomerCount,
      dealerCount,
      pendingAuditCount,
      todayOrderCount,
      todayOrderAmount,
      pendingShipCount,
      lowStockCount,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.sku.count(),
      // 零售客户：角色 retail 的用户
      this.prisma.user.count({ where: { role: 'retail' } }),
      // 分销商：审核通过
      this.prisma.distributor.count({ where: { auditStatus: 'approved' } }),
      // 分销商：待审核
      this.prisma.distributor.count({ where: { auditStatus: 'pending' } }),
      // 今日订单数
      this.prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      // 今日已付金额：paidAt 非空
      this.prisma.order.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, paidAt: { not: null } },
        _sum: { paidAmount: true },
      }),
      // 待发货：已付款但未发货
      this.prisma.order.count({ where: { status: 'pending_ship' } }),
      // 低库存 SKU（以 SKU 缓存的 stock 字段为准，若为 0 需改为聚合 stocks 表）
      this.prisma.sku.count({ where: { stock: { lte: 20 } } }),
    ])

    return {
      productCount,
      skuCount,
      retailCustomerCount,
      dealerCount,
      pendingAuditCount,
      todayOrderCount,
      todayOrderAmount: Number(todayOrderAmount._sum?.paidAmount ?? 0),
      pendingShipCount,
      lowStockCount,
    }
  }

  async salesTrend(days = 30) {
    const start = new Date()
    start.setDate(start.getDate() - days + 1)
    start.setHours(0, 0, 0, 0)

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start }, paidAt: { not: null } },
      select: { createdAt: true, paidAmount: true, channel: true },
    })

    const map = new Map<string, { retail: number; wholesale: number }>()
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      map.set(d.toISOString().slice(0, 10), { retail: 0, wholesale: 0 })
    }
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10)
      const entry = map.get(key)
      if (!entry) continue
      if (o.channel === 'wholesale') entry.wholesale += Number(o.paidAmount)
      else entry.retail += Number(o.paidAmount)
    }

    return Array.from(map.entries()).map(([date, val]) => ({ date, ...val }))
  }

  async topProducts(limit = 10) {
    const groups = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: limit,
    })

    const products = await this.prisma.product.findMany({
      where: { id: { in: groups.map(g => g.productId) } },
    })
    const pm = new Map(products.map(p => [p.id, p]))

    return groups.map(g => ({
      productId: g.productId,
      name: pm.get(g.productId)?.name || '-',
      image: pm.get(g.productId)?.mainImage || '',
      quantity: Number(g._sum?.qty ?? 0),
      amount: Number(g._sum?.subtotal ?? 0),
    }))
  }
}
