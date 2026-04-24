import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

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
        permissions: data.permissions || [],
        dataScope: data.dataScope || 'self',
        sort: data.sort ?? 0,
        status: data.status || 'active',
      },
    })
  }

  async update(id: number, data: any) {
    return this.prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        dataScope: data.dataScope,
        sort: data.sort,
        status: data.status,
      },
    })
  }

  async remove(id: number) {
    const count = await this.prisma.adminUser.count({ where: { roleId: id } })
    if (count > 0) {
      throw new BadRequestException(`该角色下还有 ${count} 个账号，无法删除`)
    }
    await this.prisma.role.delete({ where: { id } })
    return { success: true }
  }

  async updatePermissions(id: number, permissions: string[]) {
    return this.prisma.role.update({
      where: { id },
      data: { permissions },
    })
  }
}
