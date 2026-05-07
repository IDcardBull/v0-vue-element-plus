import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'
import { PageResult } from '@/common/dto/pagination.dto'

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
            include: { priceTiers: { orderBy: { minQty: 'asc' } } },
          },
          _count: { select: { skus: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ])

    // 对批发商品，附带阶梯价档位数量和总库存
    const ids = list.map((p) => p.id)
    const skuAgg = await this.prisma.sku.groupBy({
      by: ['productId'],
      where: { productId: { in: ids } },
      _sum: { stock: true },
    })
    const priceTiers = await this.prisma.priceTier.findMany({
      where: { sku: { productId: { in: ids } } },
      include: { sku: { select: { productId: true } } },
      orderBy: [{ minQty: 'asc' }],
    })
    const stockMap = new Map(skuAgg.map((s) => [s.productId, s._sum.stock || 0]))
    const tierAggMap = new Map<number, { count: number; minPrice: number; maxPrice: number }>()
    for (const tier of priceTiers) {
      const productId = tier.sku.productId
      const price = Number(tier.price)
      const current = tierAggMap.get(productId) || { count: 0, minPrice: price, maxPrice: price }
      current.count += 1
      current.minPrice = Math.min(current.minPrice, price)
      current.maxPrice = Math.max(current.maxPrice, price)
      tierAggMap.set(productId, current)
    }

    return {
      list: list.map((p) => {
        const tierAgg = tierAggMap.get(p.id)
        return {
          ...p,
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

  async findById(id: number) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        skus: {
          orderBy: { id: 'asc' },
          include: { priceTiers: { orderBy: { minQty: 'asc' } } },
        },
      },
    })
    if (!p) throw new NotFoundException('商品不存在')
    return p
  }

  async create(data: any) {
    const { skus, ...rest } = data
    const exist = await this.prisma.product.findUnique({ where: { code: rest.code } })
    if (exist) throw new BadRequestException('商品编码已存在')

    return this.prisma.product.create({
      data: {
        ...rest,
        skus: skus?.length
          ? {
              create: skus.map((s: any) => ({
                code: s.code,
                specs: s.specs || {},
                image: s.image,
                retailPrice: s.retailPrice || 0,
                memberPrice: s.memberPrice,
                costPrice: s.costPrice,
                stock: s.stock || 0,
                weight: s.weight,
              })),
            }
          : undefined,
      },
      include: { skus: true },
    })
  }

  async update(id: number, data: any) {
    const { skus, ...rest } = data
    await this.findById(id)
    // SKU 已可能被库存、流水、订单等表引用，不能直接删除；改为 upsert/禁用旧 SKU。
    if (Array.isArray(skus)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: rest })
        const existingSkus = await tx.sku.findMany({ where: { productId: id } })
        const existingById = new Map(existingSkus.map((sku) => [sku.id, sku]))
        const existingByCode = new Map(existingSkus.map((sku) => [sku.code, sku]))
        const touchedIds: number[] = []

        for (const s of skus) {
          const matchedSku = s.id ? existingById.get(Number(s.id)) : existingByCode.get(s.code)
          const skuData = {
            code: s.code,
            specs: s.specs || {},
            image: s.image,
            retailPrice: s.retailPrice || 0,
            memberPrice: s.memberPrice,
            costPrice: s.costPrice,
            stock: s.stock || 0,
            weight: s.weight,
            status: s.status ?? 1,
          }

          if (matchedSku) {
            await tx.sku.update({
              where: { id: matchedSku.id },
              data: skuData,
            })
            touchedIds.push(matchedSku.id)
          } else {
            const created = await tx.sku.create({
              data: {
                productId: id,
                ...skuData,
              },
            })
            touchedIds.push(created.id)
          }
        }

        if (existingSkus.length) {
          await tx.sku.updateMany({
            where: {
              productId: id,
              id: { notIn: touchedIds.length ? touchedIds : [0] },
            },
            data: { status: 0 },
          })
        }
      })
    } else {
      await this.prisma.product.update({ where: { id }, data: rest })
    }
    return this.findById(id)
  }

  async remove(id: number) {
    // 软删：改为下架
    return this.prisma.product.update({
      where: { id },
      data: { status: 0 },
    })
  }

  /** 上下架 */
  async toggleListing(id: number) {
    const p = await this.findById(id)
    return this.prisma.product.update({
      where: { id },
      data: { status: p.status === 1 ? 0 : 1 },
    })
  }

  /** 零售开关 */
  async toggleRetail(id: number) {
    const p = await this.findById(id)
    return this.prisma.product.update({
      where: { id },
      data: { retailEnabled: !p.retailEnabled },
    })
  }

  /** 批发开关 */
  async toggleWholesale(id: number) {
    const p = await this.findById(id)
    return this.prisma.product.update({
      where: { id },
      data: { wholesaleEnabled: !p.wholesaleEnabled },
    })
  }

  /** 显式设置上下架状态（0/1） */
  async setStatus(id: number, status: number) {
    await this.findById(id)
    return this.prisma.product.update({ where: { id }, data: { status } })
  }

  /** 显式设置零售开关 */
  async setRetail(id: number, enabled: boolean) {
    await this.findById(id)
    return this.prisma.product.update({ where: { id }, data: { retailEnabled: enabled } })
  }

  /** 显式设置批发开关 */
  async setWholesale(id: number, enabled: boolean) {
    await this.findById(id)
    return this.prisma.product.update({ where: { id }, data: { wholesaleEnabled: enabled } })
  }

  /** 批量删除 */
  async batchRemove(ids: number[]) {
    return this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status: 0 },
    })
  }
}
