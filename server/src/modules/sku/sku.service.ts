import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

@Injectable()
export class SkuService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 给 SKU 列表追加 totalOnHand / availableQty / stock 三个等价字段
   * （简化版：库存只剩 onHand，跨仓求和即可）
   */
  private async withStockAgg<T extends { id: number }>(skus: T[]) {
    if (!skus.length) return [] as Array<T & { totalOnHand: number; availableQty: number; stock: number }>
    const ids = skus.map((s) => s.id)
    const rows = await this.prisma.stock.findMany({
      where: { skuId: { in: ids } },
      select: { skuId: true, onHand: true },
    })
    const map = new Map<number, number>()
    for (const r of rows) {
      map.set(r.skuId, (map.get(r.skuId) || 0) + r.onHand)
    }
    return skus.map((s) => {
      const onHand = map.get(s.id) || 0
      return {
        ...s,
        totalOnHand: onHand,
        availableQty: onHand,
        // 兼容：旧前端字段 stock 仍指向"可用库存"
        stock: onHand,
      } as T & { totalOnHand: number; availableQty: number; stock: number }
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
   * 更新 SKU 售价
   * 仅操作 SKU 表自身的 retailPrice / memberPrice；
   * 批发阶梯价由 priceTier 模块单独维护，避免和阶梯档冲突。
   */
  async updatePrice(
    id: number,
    payload: { retailPrice?: number; memberPrice?: number },
  ) {
    const sku = await this.prisma.sku.findUnique({ where: { id }, select: { id: true } })
    if (!sku) throw new NotFoundException('SKU 不存在')

    const data: { retailPrice?: number; memberPrice?: number | null } = {}
    if (payload.retailPrice != null) {
      const v = Number(payload.retailPrice)
      if (!isFinite(v) || v < 0) throw new NotFoundException('零售价无效')
      data.retailPrice = v
    }
    if (payload.memberPrice !== undefined) {
      // 允许传 null/0 清掉会员价
      const v = payload.memberPrice == null ? null : Number(payload.memberPrice)
      if (v != null && (!isFinite(v) || v < 0)) throw new NotFoundException('会员价无效')
      data.memberPrice = v
    }
    if (Object.keys(data).length === 0) {
      // 没有要改的字段，直接返回当前值
      return this.findById(id)
    }
    await this.prisma.sku.update({ where: { id }, data })
    return this.findById(id)
  }

  /**
   * 更新 SKU 库存：写入默认仓库的 Stock.onHand
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
      create: { skuId: id, warehouseId: wh.id, onHand: safe },
      update: { onHand: safe },
    })
    return this.findById(id)
  }
}
