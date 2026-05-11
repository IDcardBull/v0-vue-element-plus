import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'
import { PageResult } from '@/common/dto/pagination.dto'

/**
 * 简化版（v2，2026-05）库存服务：
 * - 只展示 SKU/商品信息 + 现存数量 onHand
 * - 不再有出入库流水（StockLog 表已删）、不再有 reserved/inTransit/warnMin/warnMax
 * - 出入库按钮、库存预警页、出入库记录页均已下线
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------- 仓库 --------------------
  async warehouses() {
    return this.prisma.warehouse.findMany({
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    })
  }

  // -------------------- 实时库存 --------------------
  private stockInclude() {
    return {
      warehouse: { select: { id: true, name: true, code: true } },
      sku: {
        select: {
          id: true,
          code: true,
          specs: true,
          image: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              mainImage: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    } as const
  }

  private specText(specs: unknown) {
    if (!specs) return ''
    if (typeof specs === 'string') return specs
    if (Array.isArray(specs)) return specs.map((v) => String(v ?? '')).join(' ')
    if (typeof specs === 'object') return Object.values(specs as Record<string, unknown>).map((v) => String(v ?? '')).join(' ')
    return String(specs)
  }

  async stockList(q: {
    keyword?: string
    skuCode?: string
    productName?: string
    spec?: string
    warehouseId?: number
    categoryId?: number
    page?: number
    pageSize?: number
  }): Promise<PageResult<any>> {
    const page = Number(q.page) || 1
    const pageSize = Number(q.pageSize) || 20
    const skuCode = (q.skuCode || '').trim()
    const productName = (q.productName || '').trim()
    const spec = (q.spec || '').trim()
    const keyword = (q.keyword || '').trim()
    const where: any = {}
    if (q.warehouseId) where.warehouseId = Number(q.warehouseId)

    const skuWhere: any = {}
    if (skuCode) skuWhere.code = { contains: skuCode }
    if (productName || q.categoryId) {
      skuWhere.product = {
        ...(productName ? { name: { contains: productName } } : {}),
        ...(q.categoryId ? { categoryId: Number(q.categoryId) } : {}),
      }
    }
    if (keyword && !skuCode && !productName && !spec) {
      skuWhere.OR = [
        { code: { contains: keyword } },
        { product: { name: { contains: keyword } } },
        { product: { code: { contains: keyword } } },
      ]
    }
    if (Object.keys(skuWhere).length) where.sku = skuWhere

    const include = this.stockInclude()
    if (spec) {
      const rows = await this.prisma.stock.findMany({
        where,
        orderBy: [{ id: 'desc' }],
        include,
      })
      const filtered = rows.filter((row) => this.specText(row.sku?.specs).includes(spec))
      return {
        list: filtered.slice((page - 1) * pageSize, page * pageSize),
        total: filtered.length,
        page,
        pageSize,
      }
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.stock.findMany({
        where,
        orderBy: [{ id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include,
      }),
      this.prisma.stock.count({ where }),
    ])
    return { list, total, page, pageSize }
  }

  async updateStock(id: number, onHand: number) {
    const stock = await this.prisma.stock.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!stock) throw new NotFoundException('库存记录不存在')

    const safe = Math.max(Number(onHand) || 0, 0)
    return this.prisma.stock.update({
      where: { id },
      data: { onHand: safe },
      include: this.stockInclude(),
    })
  }
}
