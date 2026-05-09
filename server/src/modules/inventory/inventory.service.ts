import { Injectable } from '@nestjs/common'
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
  async stockList(q: {
    keyword?: string
    warehouseId?: number
    categoryId?: number
    page?: number
    pageSize?: number
  }): Promise<PageResult<any>> {
    const page = Number(q.page) || 1
    const pageSize = Number(q.pageSize) || 20
    const where: any = {}
    if (q.warehouseId) where.warehouseId = Number(q.warehouseId)
    if (q.keyword || q.categoryId) {
      where.sku = {
        OR: q.keyword
          ? [
              { code: { contains: q.keyword } },
              { product: { name: { contains: q.keyword } } },
              { product: { code: { contains: q.keyword } } },
            ]
          : undefined,
        product: q.categoryId ? { categoryId: Number(q.categoryId) } : undefined,
      }
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.stock.findMany({
        where,
        orderBy: [{ id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
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
        },
      }),
      this.prisma.stock.count({ where }),
    ])
    return { list, total, page, pageSize }
  }
}
