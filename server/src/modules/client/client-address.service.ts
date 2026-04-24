import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/common/prisma.service'

export interface AddressPayload {
  receiver: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
  tag?: string // 家 / 公司 / 学校
}

@Injectable()
export class ClientAddressService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    })
  }

  async findOne(userId: number, id: number) {
    const addr = await this.prisma.address.findFirst({ where: { id, userId } })
    if (!addr) throw new NotFoundException('地址不存在')
    return addr
  }

  async create(userId: number, data: AddressPayload) {
    this.validate(data)
    // 若设为默认，先把其它地址取消默认
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      })
    }
    // 若是第一条地址，强制默认
    const count = await this.prisma.address.count({ where: { userId } })
    return this.prisma.address.create({
      data: { ...data, userId, isDefault: data.isDefault ?? count === 0 },
    })
  }

  async update(userId: number, id: number, data: AddressPayload) {
    this.validate(data)
    await this.findOne(userId, id)
    if (data.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, NOT: { id } },
        data: { isDefault: false },
      })
    }
    return this.prisma.address.update({ where: { id }, data })
  }

  async remove(userId: number, id: number) {
    const addr = await this.findOne(userId, id)
    await this.prisma.address.delete({ where: { id } })
    // 若删除的是默认地址且还有其它地址，随便挑一条设为默认
    if (addr.isDefault) {
      const another = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      })
      if (another) {
        await this.prisma.address.update({
          where: { id: another.id },
          data: { isDefault: true },
        })
      }
    }
    return { ok: true }
  }

  async setDefault(userId: number, id: number) {
    await this.findOne(userId, id)
    await this.prisma.$transaction([
      this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
      this.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ])
    return { ok: true }
  }

  private validate(data: AddressPayload) {
    const required: (keyof AddressPayload)[] = [
      'receiver', 'phone', 'province', 'city', 'district', 'detail',
    ]
    for (const k of required) {
      if (!data[k] || String(data[k]).trim() === '') {
        throw new BadRequestException(`字段 ${k} 不能为空`)
      }
    }
    if (!/^1\d{10}$/.test(data.phone)) {
      throw new BadRequestException('手机号格式不正确')
    }
  }
}
