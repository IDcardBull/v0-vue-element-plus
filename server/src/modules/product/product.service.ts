import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'
import { PageResult } from '@/common/dto/pagination.dto'

function normalizeSkuImage(s: any) {
  return s?.image || s?.skuImage || s?.sku_image || s?.imageUrl || s?.image_url || undefined
}

/**
 * 把前端表单 sku.priceTiers 规范化成 PriceTier.create 入参
 * 入参示例：[{ minQty: 6, maxQty: 50, price: 38 }, ...]
 */
function normalizePriceTiers(raw: any): { minQty: number; maxQty: number | null; price: number; sort: number }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t: any, i: number) => ({
      minQty: Number(t.minQty ?? t.min_qty ?? 1),
      maxQty:
        t.maxQty == null && t.max_qty == null
          ? null
          : Number(t.maxQty ?? t.max_qty),
      price: Number(t.price ?? 0),
      sort: Number(t.sort ?? i),
    }))
    .filter((t) => Number.isFinite(t.minQty) && t.minQty >= 1 && Number.isFinite(t.price) && t.price >= 0)
}

interface ProductQuery {
  keyword?: string
  categoryId?: number
  brandId?: number
  craft?: string
  status?: number
  /** retail / wholesale / all，对应零售商品/批发商品/全部 */
  channel?: string
  page?: number
  pageSize?: number
  /** 排序字段：id | createdAt | salesCount | retailPrice */
  sortField?: 'id' | 'createdAt' | 'salesCount' | 'retailPrice'
  sortOrder?: 'asc' | 'desc'
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: ProductQuery): Promise<PageResult<any>> {
    const page = Number(q.page) || 1
    const pageSize = Number(q.pageSize) || 20

    const where: any = {}
    if (q.keyword) {
      where.OR = [{ name: { contains: q.keyword } }, { code: { contains: q.keyword } }]
    }
    if (q.categoryId) where.categoryId = Number(q.categoryId)
    if (q.brandId) where.brandId = Number(q.brandId)
    if (q.craft) where.craft = q.craft
    if (q.status !== undefined) where.status = Number(q.status)
    if (q.channel === 'retail') where.retailEnabled = true
    if (q.channel === 'wholesale') where.wholesaleEnabled = true

    const sortField = q.sortField || 'id'
    const sortOrder = q.sortOrder || 'desc'
    const [list, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ [sortField]: sortOrder } as any],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          skus: {
            where: { status: 1 },
            orderBy: { id: 'asc' },
            // 列表的 SKU 不带 priceTiers，避免零售端拉到批发阶梯价
            include: q.channel === 'wholesale' ? { priceTiers: { orderBy: { minQty: 'asc' } } } : undefined,
          },
          _count: { select: { skus: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ])

    // 实际可用库存 = sum(stocks.onHand - stocks.reserved)
    // 同时按 product 维度（用于 totalStock）和 sku 维度（注入 sku.stock）双聚合
    const ids = list.map((p) => p.id)
    const stockRows = await this.prisma.stock.findMany({
      where: { sku: { productId: { in: ids } } },
      select: { skuId: true, onHand: true, reserved: true, sku: { select: { productId: true } } },
    })
    const stockMap = new Map<number, number>() // productId -> available
    const skuStockMap = new Map<number, { onHand: number; reserved: number }>() // skuId -> agg
    for (const r of stockRows) {
      const pid = r.sku.productId
      stockMap.set(pid, (stockMap.get(pid) || 0) + Math.max(r.onHand - r.reserved, 0))
      const m = skuStockMap.get(r.skuId) || { onHand: 0, reserved: 0 }
      m.onHand += r.onHand
      m.reserved += r.reserved
      skuStockMap.set(r.skuId, m)
    }

    // 批发列表才需要返回阶梯价聚合
    let tierAggMap = new Map<number, { count: number; minPrice: number; maxPrice: number }>()
    if (q.channel === 'wholesale') {
      const priceTiers = await this.prisma.priceTier.findMany({
        where: { sku: { productId: { in: ids } } },
        include: { sku: { select: { productId: true } } },
        orderBy: [{ minQty: 'asc' }],
      })
      for (const tier of priceTiers) {
        const productId = tier.sku.productId
        const price = Number(tier.price)
        const current = tierAggMap.get(productId) || { count: 0, minPrice: price, maxPrice: price }
        current.count += 1
        current.minPrice = Math.min(current.minPrice, price)
        current.maxPrice = Math.max(current.maxPrice, price)
        tierAggMap.set(productId, current)
      }
    }

    return {
      list: list.map((p) => {
        const tierAgg = tierAggMap.get(p.id)
        // 给每个 SKU 注入聚合后的库存字段（与 findById 口径一致）
        const skus = (p.skus || []).map((s: any) => {
          const agg = skuStockMap.get(s.id) || { onHand: 0, reserved: 0 }
          const available = Math.max(agg.onHand - agg.reserved, 0)
          return {
            ...s,
            totalOnHand: agg.onHand,
            totalReserved: agg.reserved,
            availableQty: available,
            stock: available,
          }
        })
        return {
          ...p,
          skus,
          skuCount: p._count.skus,
          totalStock: stockMap.get(p.id) || 0,
          priceTierCount: tierAgg?.count || 0,
          tierMinPrice: tierAgg?.minPrice || 0,
          tierMaxPrice: tierAgg?.maxPrice || 0,
        }
      }),
      total,
      page,
      pageSize,
    }
  }

  /**
   * 商品详情。
   * channel='retail' 时不返回 priceTiers / 批发字段，避免污染零售端。
   * 所有 channel 都会把每个 SKU 的可用库存（Stock 表聚合）注入到 sku.stock。
   */
  async findById(id: number, channel?: 'retail' | 'wholesale' | 'admin') {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        skus: {
          orderBy: { id: 'asc' },
          include: channel === 'retail' ? undefined : { priceTiers: { orderBy: { minQty: 'asc' } } },
        },
      },
    })
    if (!p) throw new NotFoundException('商品不存在')

    // 计算 SKU 库存聚合：可用 = sum(onHand) - sum(reserved)
    const skuIds = (p.skus || []).map((s) => s.id)
    const stockRows = skuIds.length
      ? await this.prisma.stock.findMany({
          where: { skuId: { in: skuIds } },
          select: { skuId: true, onHand: true, reserved: true },
        })
      : []
    const stockMap = new Map<number, { onHand: number; reserved: number }>()
    for (const r of stockRows) {
      const m = stockMap.get(r.skuId) || { onHand: 0, reserved: 0 }
      m.onHand += r.onHand
      m.reserved += r.reserved
      stockMap.set(r.skuId, m)
    }
    const enrichSku = (s: any) => {
      const agg = stockMap.get(s.id) || { onHand: 0, reserved: 0 }
      const available = Math.max(agg.onHand - agg.reserved, 0)
      return {
        ...s,
        totalOnHand: agg.onHand,
        totalReserved: agg.reserved,
        availableQty: available,
        // 前端兼容字段：sku.stock = 可用库存
        stock: available,
      }
    }

    if (channel === 'retail') {
      const { wholesaleEnabled, minWholesaleQty, dealerLevels, ...rest } = p as any
      void wholesaleEnabled
      void minWholesaleQty
      void dealerLevels
      rest.skus = (p.skus || []).map((s: any) => {
        const { priceTiers, ...skuRest } = s
        void priceTiers
        return enrichSku(skuRest)
      })
      return rest
    }
    return { ...p, skus: (p.skus || []).map((s: any) => enrichSku(s)) }
  }

  /** 取一个默认仓库 id：优先 isDefault=true，否则取最早建的那个 */
  private async getDefaultWarehouseId(tx: any): Promise<number | null> {
    const wh =
      (await tx.warehouse.findFirst({ where: { isDefault: true, status: 1 } })) ||
      (await tx.warehouse.findFirst({ where: { status: 1 }, orderBy: { id: 'asc' } }))
    return wh?.id ?? null
  }

  /** 给指定 SKU 在默认仓库 upsert 一条 Stock 记录 */
  private async upsertStockForSku(
    tx: any,
    skuId: number,
    onHand: number,
    warehouseId: number | null,
  ) {
    if (!warehouseId) return
    const safeOnHand = Math.max(Number(onHand) || 0, 0)
    await tx.stock.upsert({
      where: { skuId_warehouseId: { skuId, warehouseId } },
      create: { skuId, warehouseId, onHand: safeOnHand, reserved: 0 },
      // onHand 仅在前端明确传新值时才覆盖；这里业务上"商品编辑里的库存数字"就代表默认仓数量
      update: { onHand: safeOnHand },
    })
  }

  async create(data: any) {
    const { skus, ...rest } = data
    const exist = await this.prisma.product.findUnique({ where: { code: rest.code } })
    if (exist) throw new BadRequestException('商品编码已存在')

    const productScalars = {
      ...rest,
      // 显式接 freeShipping / shippingFee（兼容下划线/驼峰传参）
      freeShipping: rest.freeShipping === true || rest.free_shipping === true,
      shippingFee:
        rest.shippingFee != null
          ? Number(rest.shippingFee)
          : rest.shipping_fee != null
            ? Number(rest.shipping_fee)
            : 0,
    }
    delete (productScalars as any).free_shipping
    delete (productScalars as any).shipping_fee

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...productScalars,
          skus: skus?.length
            ? {
                create: skus.map((s: any) => ({
                  code: s.code,
                  specs: s.specs || {},
                  image: normalizeSkuImage(s),
                  retailPrice: Number(s.retailPrice || 0),
                  // memberPrice 严格表示"零售会员价"，前端绝不能再把批发价塞进来
                  memberPrice: s.memberPrice == null || s.memberPrice === '' ? null : Number(s.memberPrice),
                  costPrice: s.costPrice == null || s.costPrice === '' ? null : Number(s.costPrice),
                  // 库存不写 Sku 表，下面 upsertStockForSku 写到 Stock 表（唯一真源）
                  weight: s.weight == null || s.weight === '' ? null : Number(s.weight),
                  status: s.status ?? 1,
                })),
              }
            : undefined,
        },
        include: { skus: true },
      })

      // 同步：给每个新建 SKU 在默认仓建 Stock + 写 PriceTier
      const warehouseId = await this.getDefaultWarehouseId(tx)
      for (let i = 0; i < (created.skus || []).length; i++) {
        const newSku = created.skus[i]
        const formSku = skus[i] || {}
        await this.upsertStockForSku(tx, newSku.id, formSku.stock || 0, warehouseId)
        const tiers = normalizePriceTiers(formSku.priceTiers)
        if (tiers.length) {
          await tx.priceTier.createMany({
            data: tiers.map((t) => ({ skuId: newSku.id, ...t })),
          })
        }
      }
      return created
    })
  }

  async update(id: number, data: any) {
    const { skus, ...rest } = data
    await this.findById(id, 'admin')

    const productScalars: any = { ...rest }
    if (rest.freeShipping !== undefined || rest.free_shipping !== undefined) {
      productScalars.freeShipping = rest.freeShipping === true || rest.free_shipping === true
    }
    if (rest.shippingFee !== undefined || rest.shipping_fee !== undefined) {
      const v = rest.shippingFee ?? rest.shipping_fee
      productScalars.shippingFee = v == null || v === '' ? 0 : Number(v)
    }
    delete productScalars.free_shipping
    delete productScalars.shipping_fee

    if (Array.isArray(skus)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: productScalars })
        const warehouseId = await this.getDefaultWarehouseId(tx)
        const existingSkus = await tx.sku.findMany({ where: { productId: id } })
        const existingById = new Map(existingSkus.map((sku) => [sku.id, sku]))
        const existingByCode = new Map(existingSkus.map((sku) => [sku.code, sku]))
        const touchedIds: number[] = []

        for (const s of skus) {
          const matchedSku = s.id ? existingById.get(Number(s.id)) : existingByCode.get(s.code)
          // 表单 stock 不再写到 Sku 表，由 Stock 表唯一持有
          const formStock = Number(s.stock || 0)
          const skuData = {
            code: s.code,
            specs: s.specs || {},
            image: normalizeSkuImage(s),
            retailPrice: Number(s.retailPrice || 0),
            memberPrice: s.memberPrice == null || s.memberPrice === '' ? null : Number(s.memberPrice),
            costPrice: s.costPrice == null || s.costPrice === '' ? null : Number(s.costPrice),
            weight: s.weight == null || s.weight === '' ? null : Number(s.weight),
            status: s.status ?? 1,
          }

          let skuId: number
          if (matchedSku) {
            await tx.sku.update({ where: { id: matchedSku.id }, data: skuData })
            skuId = matchedSku.id
          } else {
            const created = await tx.sku.create({ data: { productId: id, ...skuData } })
            skuId = created.id
          }
          touchedIds.push(skuId)

          // 同步默认仓 Stock（注意：不会动 reserved，避免覆盖正在占用中的订单）
          await this.upsertStockForSku(tx, skuId, formStock, warehouseId)

          // 重写 PriceTier：先删再插（priceTiers 数量通常很少，简单就好）
          await tx.priceTier.deleteMany({ where: { skuId } })
          const tiers = normalizePriceTiers(s.priceTiers)
          if (tiers.length) {
            await tx.priceTier.createMany({
              data: tiers.map((t) => ({ skuId, ...t })),
            })
          }
        }

        if (existingSkus.length) {
          await tx.sku.updateMany({
            where: { productId: id, id: { notIn: touchedIds.length ? touchedIds : [0] } },
            data: { status: 0 },
          })
        }
      })
    } else {
      await this.prisma.product.update({ where: { id }, data: productScalars })
    }
    return this.findById(id, 'admin')
  }

  async remove(id: number) {
    return this.prisma.product.update({
      where: { id },
      data: { status: 0 },
    })
  }

  async toggleListing(id: number) {
    const p = await this.findById(id, 'admin')
    return this.prisma.product.update({
      where: { id },
      data: { status: p.status === 1 ? 0 : 1 },
    })
  }

  async toggleRetail(id: number) {
    const p = await this.findById(id, 'admin')
    return this.prisma.product.update({
      where: { id },
      data: { retailEnabled: !p.retailEnabled },
    })
  }

  async toggleWholesale(id: number) {
    const p = await this.findById(id, 'admin')
    return this.prisma.product.update({
      where: { id },
      data: { wholesaleEnabled: !p.wholesaleEnabled },
    })
  }

  async setStatus(id: number, status: number) {
    await this.findById(id, 'admin')
    return this.prisma.product.update({ where: { id }, data: { status } })
  }

  async setRetail(id: number, enabled: boolean) {
    await this.findById(id, 'admin')
    return this.prisma.product.update({ where: { id }, data: { retailEnabled: enabled } })
  }

  async setWholesale(id: number, enabled: boolean) {
    await this.findById(id, 'admin')
    return this.prisma.product.update({ where: { id }, data: { wholesaleEnabled: enabled } })
  }

  async batchRemove(ids: number[]) {
    return this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status: 0 },
    })
  }
}
