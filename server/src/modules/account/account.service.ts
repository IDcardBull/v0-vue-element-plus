import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import * as bcrypt from 'bcryptjs'

/** 前端传入的 status 可能是 'active'/'inactive' 字符串，数据库是 Int（1/0） */
function toStatusInt(status: any): number | undefined {
  if (status === undefined || status === null || status === '') return undefined
  if (typeof status === 'number') return status
  return status === 'inactive' || status === 'disabled' || status === '0' ? 0 : 1
}

/** 把 AdminUser + 关联的 roles 扁平化成前端期望的 { ..., role: { id, name, code }, roleId } */
function flattenAdminUser(user: any) {
  if (!user) return user
  const { password, roles = [], ...rest } = user
  const firstRole = roles?.[0]?.role
  return {
    ...rest,
    roleId: firstRole?.id ?? null,
    role: firstRole ?? null,
    roles: roles.map((r: any) => r.role).filter(Boolean),
  }
}

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { page?: number; pageSize?: number; keyword?: string; status?: any; roleId?: number }) {
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
    const statusInt = toStatusInt(query.status)
    if (statusInt !== undefined) where.status = statusInt
    if (query.roleId) where.roles = { some: { roleId: Number(query.roleId) } }

    const [list, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.adminUser.count({ where }),
    ])

    return { list: list.map(flattenAdminUser), total, page, pageSize }
  }

  async findById(id: number) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    })
    if (!user) throw new NotFoundException('账号不存在')
    return flattenAdminUser(user)
  }

  async create(data: any) {
    const exists = await this.prisma.adminUser.findUnique({ where: { username: data.username } })
    if (exists) throw new ConflictException('用户名已存在')

    const hash = await bcrypt.hash(data.password || '123456', 10)
    const roleId = data.roleId ? Number(data.roleId) : null

    const created = await this.prisma.adminUser.create({
      data: {
        username: data.username,
        password: hash,
        realName: data.realName,
        phone: data.phone,
        email: data.email,
        department: data.department,
        status: toStatusInt(data.status) ?? 1,
        ...(roleId
          ? { roles: { create: [{ roleId }] } }
          : {}),
      },
      include: { roles: { include: { role: true } } },
    })
    return flattenAdminUser(created)
  }

  async update(id: number, data: any) {
    const payload: any = {
      realName: data.realName,
      phone: data.phone,
      email: data.email,
      department: data.department,
    }
    const statusInt = toStatusInt(data.status)
    if (statusInt !== undefined) payload.status = statusInt
    if (data.password) payload.password = await bcrypt.hash(data.password, 10)

    // 如果传入 roleId，则替换账号与角色的绑定
    if (data.roleId !== undefined && data.roleId !== null && data.roleId !== '') {
      const roleId = Number(data.roleId)
      await this.prisma.adminUserRole.deleteMany({ where: { adminUserId: id } })
      await this.prisma.adminUserRole.create({ data: { adminUserId: id, roleId } })
    }

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: payload,
      include: { roles: { include: { role: true } } },
    })
    return flattenAdminUser(updated)
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
