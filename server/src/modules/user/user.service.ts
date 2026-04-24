import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // ============ 零售客户 ============
  async findCustomers(query: {
    page?: number
    pageSize?: number
    keyword?: string
    level?: string
    status?: string
  }) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20
    const where: any = { role: 'retail' }

    if (query.keyword) {
      where.OR = [
        { nickname: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
      ]
    }
    if (query.level) where.memberLevel = query.level
    if (query.status) where.status = query.status

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ])

    return { list, total, page, pageSize }
  }

  async findCustomerById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { items: true },
        },
        addresses: true,
      },
    })
    if (!user || user.role !== 'retail') {
      throw new NotFoundException('客户不存在')
    }
    return user
  }

  async updateCustomer(id: number, data: any) {
    return this.prisma.user.update({
      where: { id },
      data: {
        nickname: data.nickname,
        memberLevel: data.memberLevel,
        status: data.status,
        remark: data.remark,
      },
    })
  }

  // ============ 分销商 ============
  async findDistributors(query: {
    page?: number
    pageSize?: number
    keyword?: string
    level?: string
    auditStatus?: string
    status?: string
  }) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20
    const where: any = { role: 'dealer' }

    if (query.keyword) {
      where.OR = [
        { nickname: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
        { companyName: { contains: query.keyword } },
      ]
    }
    if (query.level) where.dealerLevel = query.level
    if (query.auditStatus) where.auditStatus = query.auditStatus
    if (query.status) where.status = query.status

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ])

    return { list, total, page, pageSize }
  }

  async findDistributorById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        statements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!user || user.role !== 'dealer') {
      throw new NotFoundException('分销商不存在')
    }
    return user
  }

  async updateDistributor(id: number, data: any) {
    return this.prisma.user.update({
      where: { id },
      data: {
        nickname: data.nickname,
        companyName: data.companyName,
        dealerLevel: data.dealerLevel,
        creditLimit: data.creditLimit,
        status: data.status,
        remark: data.remark,
      },
    })
  }

  async auditDistributor(id: number, pass: boolean, remark?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('分销商不存在')
    if (user.auditStatus === 'approved' && pass) {
      throw new BadRequestException('该分销商已审核通过')
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        auditStatus: pass ? 'approved' : 'rejected',
        status: pass ? 'active' : 'disabled',
        auditRemark: remark,
        auditedAt: new Date(),
      },
    })
  }
}
