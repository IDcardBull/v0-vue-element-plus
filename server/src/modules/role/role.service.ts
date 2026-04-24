import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

function toStatusInt(status: any): number | undefined {
  if (status === undefined || status === null || status === '') return undefined
  if (typeof status === 'number') return status
  return status === 'inactive' || status === 'disabled' || status === '0' ? 0 : 1
}

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { sort: 'asc' },
    })
  }

  async findById(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    })
    if (!role) throw new NotFoundException('角色不存在')
    return role
  }

  async create(data: any) {
    const exists = await this.prisma.role.findUnique({ where: { code: data.code } })
    if (exists) throw new ConflictException('角色编码已存在')

    return this.prisma.role.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        menuPerms: data.permissions ?? data.menuPerms ?? [],
        dataPerms: data.dataScope ? { scope: data.dataScope } : (data.dataPerms ?? undefined),
        apiPerms: data.apiPerms ?? undefined,
        sort: data.sort ?? 0,
        status: toStatusInt(data.status) ?? 1,
      },
    })
  }

  async update(id: number, data: any) {
    const payload: any = {
      name: data.name,
      description: data.description,
      sort: data.sort,
    }
    if (data.permissions !== undefined || data.menuPerms !== undefined) {
      payload.menuPerms = data.permissions ?? data.menuPerms
    }
    if (data.dataScope !== undefined) {
      payload.dataPerms = { scope: data.dataScope }
    } else if (data.dataPerms !== undefined) {
      payload.dataPerms = data.dataPerms
    }
    if (data.apiPerms !== undefined) payload.apiPerms = data.apiPerms
    const statusInt = toStatusInt(data.status)
    if (statusInt !== undefined) payload.status = statusInt

    return this.prisma.role.update({
      where: { id },
      data: payload,
    })
  }

  async remove(id: number) {
    // 账号-角色 中间表统计
    const count = await this.prisma.adminUserRole.count({ where: { roleId: id } })
    if (count > 0) {
      throw new BadRequestException(`该角色下还有 ${count} 个账号，无法删除`)
    }
    await this.prisma.role.delete({ where: { id } })
    return { success: true }
  }

  async updatePermissions(id: number, permissions: string[]) {
    return this.prisma.role.update({
      where: { id },
      data: { menuPerms: permissions },
    })
  }
}
