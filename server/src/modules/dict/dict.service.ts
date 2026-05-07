import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

@Injectable()
export class DictService {
  constructor(private readonly prisma: PrismaService) {}

  async types() {
    return this.prisma.dictType.findMany({
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { items: true } } },
    })
  }

  async ensureType(typeCode: string, typeName?: string) {
    const code = typeCode.trim()
    if (!code) throw new BadRequestException('字典类型编码不能为空')
    return this.prisma.dictType.upsert({
      where: { code },
      create: { code, name: typeName || code },
      update: typeName ? { name: typeName } : {},
    })
  }

  async items(typeCode: string, includeDisabled = false) {
    return this.prisma.dictItem.findMany({
      where: {
        typeCode,
        ...(includeDisabled ? {} : { status: 1 }),
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })
  }

  async createItem(typeCode: string, data: any) {
    await this.ensureType(typeCode, data.typeName)
    const label = String(data.label || data.value || '').trim()
    const value = String(data.value || data.label || '').trim()
    if (!label || !value) throw new BadRequestException('字典项名称和值不能为空')

    const exists = await this.prisma.dictItem.findUnique({
      where: { typeCode_value: { typeCode, value } },
    })
    if (exists) throw new BadRequestException('字典项已存在')

    return this.prisma.dictItem.create({
      data: {
        typeCode,
        label,
        value,
        sort: Number(data.sort) || 0,
        status: data.status === undefined ? 1 : Number(data.status),
        remark: data.remark,
      },
    })
  }

  async updateItem(id: number, data: any) {
    await this.findItem(id)
    return this.prisma.dictItem.update({
      where: { id },
      data: {
        label: data.label,
        value: data.value,
        sort: data.sort === undefined ? undefined : Number(data.sort),
        status: data.status === undefined ? undefined : Number(data.status),
        remark: data.remark,
      },
    })
  }

  async findItem(id: number) {
    const item = await this.prisma.dictItem.findUnique({ where: { id } })
    if (!item) throw new NotFoundException('字典项不存在')
    return item
  }

  async removeItem(id: number) {
    await this.findItem(id)
    return this.prisma.dictItem.delete({ where: { id } })
  }

  async toggleItem(id: number) {
    const item = await this.findItem(id)
    return this.prisma.dictItem.update({
      where: { id },
      data: { status: item.status === 1 ? 0 : 1 },
    })
  }
}
