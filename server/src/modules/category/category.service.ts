import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取完整分类树 */
  async tree() {
    const all = await this.prisma.category.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { products: true } } },
    })
    const map = new Map<number, any>()
    const roots: any[] = []
    for (const c of all) {
      map.set(c.id, { ...c, productCount: c._count.products, children: [] })
    }
    for (const c of all) {
      const node = map.get(c.id)
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId).children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ level: 'asc' }, { sort: 'asc' }],
    })
  }

  async findById(id: number) {
    const c = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: { select: { products: true, children: true } },
      },
    })
    if (!c) throw new NotFoundException('分类不存在')
    return {
      ...c,
      productCount: c._count.products,
      childrenCount: c._count.children,
    }
  }

  async create(data: any) {
    let level = 1
    if (data.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: data.parentId } })
      if (!parent) throw new BadRequestException('父分类不存在')
      level = parent.level + 1
    }
    return this.prisma.category.create({ data: { ...data, level } })
  }

  async update(id: number, data: any) {
    await this.findById(id)
    return this.prisma.category.update({ where: { id }, data })
  }

  async remove(id: number) {
    const hasChild = await this.prisma.category.count({ where: { parentId: id } })
    if (hasChild) throw new BadRequestException('请先删除子分类')
    const hasProduct = await this.prisma.product.count({ where: { categoryId: id } })
    if (hasProduct) throw new BadRequestException('该分类下还有商品，无法删除')
    return this.prisma.category.delete({ where: { id } })
  }

  async toggleStatus(id: number) {
    const c = await this.findById(id)
    return this.prisma.category.update({
      where: { id },
      data: { status: c.status === 1 ? 0 : 1 },
    })
  }
}
