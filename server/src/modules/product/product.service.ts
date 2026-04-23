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

    const [list, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
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
    const tierCount = await this.prisma.priceTier.groupBy({
      by: ['skuId'],
      where: { sku: { productId: { in: ids } } },
      _count: true,
    })
    const stockMap = new Map(skuAgg.map((s) => [s.productId, s._sum.stock || 0]))

    return {
      list: list.map((p) => ({
        ...p,
        skuCount: p._count.skus,
        totalStock: stockMap.get(p.id) || 0,
        priceTierCount: tierCount.filter((t) => t).length, // simplified
      })),
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
    // 简化处理：先删全部 SKU 再重建（生产建议逐条 upsert）
    if (Array.isArray(skus)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: rest })
        const existingSkus = await tx.sku.findMany({ where: { productId: id } })
        const keepIds = skus.filter((s) => s.id).map((s) => s.id)
        // 删除不再需要的
        await tx.sku.deleteMany({
          where: { productId: id, id: { notIn: keepIds.length ? keepIds : [0] } },
        })
        for (const s of skus) {
          if (s.id) {
            await tx.sku.update({
              where: { id: s.id },
              data: {
                code: s.code,
                specs: s.specs,
                image: s.image,
                retailPrice: s.retailPrice,
                memberPrice: s.memberPrice,
                costPrice: s.costPrice,
                stock: s.stock,
                weight: s.weight,
              },
            })
          } else {
            await tx.sku.create({
              data: {
                productId: id,
                code: s.code,
                specs: s.specs || {},
                image: s.image,
                retailPrice: s.retailPrice || 0,
                memberPrice: s.memberPrice,
                costPrice: s.costPrice,
                stock: s.stock || 0,
                weight: s.weight,
              },
            })
          }
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

  /** 批量删除 */
  async batchRemove(ids: number[]) {
    return this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status: 0 },
    })
  }
}
