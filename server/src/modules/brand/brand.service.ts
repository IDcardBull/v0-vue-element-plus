import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'
import { PageResult } from '@/common/dto/pagination.dto'

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async search(keyword?: string, status?: number, page = 1, pageSize = 20): Promise<PageResult<any>> {
    const where: any = {}
    if (keyword) where.OR = [{ name: { contains: keyword } }, { code: { contains: keyword } }]
    if (status !== undefined) where.status = Number(status)
    const [list, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.brand.count({ where }),
    ])
    return {
      list: list.map((b) => ({ ...b, productCount: b._count.products })),
      total,
      page,
      pageSize,
    }
  }

  async findAll() {
    return this.prisma.brand.findMany({
      where: { status: 1 },
      orderBy: [{ sort: 'asc' }],
    })
  }

  async findById(id: number) {
    const b = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    })
    if (!b) throw new NotFoundException('品牌不存在')
    return { ...b, productCount: b._count.products }
  }

  async create(data: any) {
    const exist = await this.prisma.brand.findUnique({ where: { code: data.code } })
    if (exist) throw new BadRequestException('品牌编码已存在')
    return this.prisma.brand.create({ data })
  }

  async update(id: number, data: any) {
    await this.findById(id)
    return this.prisma.brand.update({ where: { id }, data })
  }

  async remove(id: number) {
    const cnt = await this.prisma.product.count({ where: { brandId: id } })
    if (cnt) throw new BadRequestException('该品牌下还有商品，无法删除')
    return this.prisma.brand.delete({ where: { id } })
  }

  async toggleStatus(id: number, next?: number) {
    const b = await this.findById(id)
    const target = next === undefined ? (b.status === 1 ? 0 : 1) : next
    return this.prisma.brand.update({
      where: { id },
      data: { status: target },
    })
  }
}
