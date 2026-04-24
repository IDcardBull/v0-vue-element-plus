import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

@Injectable()
export class SkuService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProduct(productId: number) {
    return this.prisma.sku.findMany({
      where: { productId },
      orderBy: { id: 'asc' },
      include: { priceTiers: { orderBy: { minQty: 'asc' } } },
    })
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
    return s
  }

  async updateStock(id: number, stock: number) {
    return this.prisma.sku.update({ where: { id }, data: { stock } })
  }
}
