import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { page?: number; pageSize?: number; keyword?: string; status?: string; roleId?: number }) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20
    const where: any = {}

    if (query.keyword) {
      where.OR = [
        { username: { contains: query.keyword } },
        { realName: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
      ]
    }
    if (query.status) where.status = query.status
    if (query.roleId) where.roleId = Number(query.roleId)

    const [list, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        include: { role: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.adminUser.count({ where }),
    ])

    // 脱敏
    const safe = list.map(({ password, ...rest }) => rest)
    return { list: safe, total, page, pageSize }
  }

  async findById(id: number) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { role: true },
    })
    if (!user) throw new NotFoundException('账号不存在')
    const { password, ...rest } = user
    return rest
  }

  async create(data: any) {
    const exists = await this.prisma.adminUser.findUnique({ where: { username: data.username } })
    if (exists) throw new ConflictException('用户名已存在')

    const hash = await bcrypt.hash(data.password || '123456', 10)
    const created = await this.prisma.adminUser.create({
      data: {
        username: data.username,
        password: hash,
        realName: data.realName,
        phone: data.phone,
        email: data.email,
        department: data.department,
        roleId: Number(data.roleId),
        status: data.status || 'active',
      },
      include: { role: true },
    })
    const { password, ...rest } = created
    return rest
  }

  async update(id: number, data: any) {
    const payload: any = {
      realName: data.realName,
      phone: data.phone,
      email: data.email,
      department: data.department,
      status: data.status,
    }
    if (data.roleId) payload.roleId = Number(data.roleId)
    if (data.password) payload.password = await bcrypt.hash(data.password, 10)

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: payload,
      include: { role: true },
    })
    const { password, ...rest } = updated
    return rest
  }

  async remove(id: number) {
    await this.prisma.adminUser.delete({ where: { id } })
    return { success: true }
  }

  async resetPassword(id: number, newPwd?: string) {
    const hash = await bcrypt.hash(newPwd || '123456', 10)
    await this.prisma.adminUser.update({ where: { id }, data: { password: hash } })
    return { success: true, newPassword: newPwd || '123456' }
  }
}
