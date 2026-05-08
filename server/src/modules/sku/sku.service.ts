import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

@Injectable()
export class SkuService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 给 SKU 列表追加 totalOnHand / totalReserved / availableQty
   * （从 Stock 表按 skuId 聚合，跨所有仓库求和）
   */
  private async withStockAgg<T extends { id: number }>(skus: T[]) {
    if (!skus.length) return [] as Array<T & { totalOnHand: number; totalReserved: number; availableQty: number }>
    const ids = skus.map((s) => s.id)
    const rows = await this.prisma.stock.findMany({
      where: { skuId: { in: ids } },
      select: { skuId: true, onHand: true, reserved: true },
    })
    const map = new Map<number, { onHand: number; reserved: number }>()
    for (const r of rows) {
      const m = map.get(r.skuId) || { onHand: 0, reserved: 0 }
      m.onHand += r.onHand
      m.reserved += r.reserved
      map.set(r.skuId, m)
    }
    return skus.map((s) => {
      const agg = map.get(s.id) || { onHand: 0, reserved: 0 }
      const available = Math.max(agg.onHand - agg.reserved, 0)
      return {
        ...s,
        totalOnHand: agg.onHand,
        totalReserved: agg.reserved,
        availableQty: available,
        // 兼容：旧前端字段 stock 仍指向"可用库存"
        stock: available,
      } as T & { totalOnHand: number; totalReserved: number; availableQty: number }
    })
  }

  async findByProduct(productId: number) {
    const skus = await this.prisma.sku.findMany({
      where: { productId },
      orderBy: { id: 'asc' },
      include: { priceTiers: { orderBy: { minQty: 'asc' } } },
    })
    return this.withStockAgg(skus)
  }

  async findById(id: number) {
    const s = await this.prisma.sku.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, code: true, mainImage: true } },
        priceTiers: { orderBy: { minQty: 'asc' } },
      },
    })
    if (!s) throw new NotFoundException('SKU 不存在')
    const [withAgg] = await this.withStockAgg([s])
    return withAgg
  }

  /**
   * 更新 SKU 库存：写入默认仓库的 Stock.onHand。
   * 不再写 Sku.stock（该字段已删除，库存唯一真源是 Stock 表）。
   */
  async updateStock(id: number, stock: number) {
    const sku = await this.prisma.sku.findUnique({ where: { id }, select: { id: true } })
    if (!sku) throw new NotFoundException('SKU 不存在')

    const wh =
      (await this.prisma.warehouse.findFirst({
        where: { isDefault: true, status: 1 },
        orderBy: { id: 'asc' },
      })) ||
      (await this.prisma.warehouse.findFirst({ where: { status: 1 }, orderBy: { id: 'asc' } }))
    if (!wh) throw new NotFoundException('未配置任何启用中的仓库，请先到"库存管理 > 仓库"新建')

    const safe = Math.max(Number(stock) || 0, 0)
    await this.prisma.stock.upsert({
      where: { skuId_warehouseId: { skuId: id, warehouseId: wh.id } },
      create: { skuId: id, warehouseId: wh.id, onHand: safe, reserved: 0 },
      update: { onHand: safe }, // 仅覆盖 onHand，不动 reserved
    })
    return this.findById(id)
  }
}
